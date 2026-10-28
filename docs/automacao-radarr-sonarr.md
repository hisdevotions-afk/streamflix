# Automação: Radarr + Sonarr + Prowlarr + qBittorrent

Como o Streamflix pede filmes e séries, acompanha a fila e mantém a biblioteca
automaticamente. Radarr/Sonarr gerenciam, Prowlarr centraliza os indexers,
qBittorrent baixa e o Jellyfin continua sendo o player e a fonte da verdade do
progresso.

## TL;DR

- `docker compose up -d` sobe **Jellyfin :8096**, **Radarr :7878**, **Sonarr :8989**,
  **Prowlarr :9696** e **qBittorrent :8080**.
- `./scripts/setup-pipeline.sh` descobre as API keys, cria as pastas, configura o
  qBittorrent (senha, pastas e categorias), conecta o downloader aos dois *arr e
  liga Radarr/Sonarr ao Prowlarr. É idempotente.
- O backend expõe `/api/arr/{search,status,lookup,add,library,queue}` e
  `/api/pipeline/status`; as credenciais nunca vão para o navegador.
- A barra de pesquisa da tela inicial busca filmes e séries juntos no catálogo e
  pede em um clique; a página `/automacao` mostra fila, biblioteca e saúde.
- **Indexers**: cadastrados em `Prowlarr → Indexers` e replicados para Radarr/Sonarr.

```
Navegador (/automacao)
   │  POST /api/arr/add { kind, arrId }
   ▼
Next BFF /api/arr/*  ── X-Api-Key ──▶  Radarr :7878  /  Sonarr :8989
                                            │  ▲
                         Prowlarr :9696 ────┘  │ (sync de indexers)
                                            ▼
                                    qBittorrent :8080
                                            │
                                            ▼
                                   /downloads/complete
                                            │ import/rename
                                            ▼
                                   ~/Midia (Jellyfin :8096)
```

## O que é "esteira" aqui

| Etapa | Quem faz | Estado neste repo |
| --- | --- | --- |
| Pedido (filme/série) | `/automacao` → `/api/arr/add` | pronto |
| Catálogo (TMDB/TVDB) | Radarr/Sonarr `lookup` | pronto |
| Monitoramento + qualidade | perfis do Radarr/Sonarr | pronto |
| Busca de release | Prowlarr + indexers | pronto |
| Download | qBittorrent | pronto |
| Import/rename | Radarr/Sonarr | pronto (quando houver download) |
| Indexação/player | Jellyfin | pronto |

O backend reporta o que falta: `/api/arr/status` devolve os avisos de saúde do
Radarr/Sonarr e `/api/pipeline/status` mostra Prowlarr/qBittorrent. A página
`/automacao` exibe os avisos e um alerta quando o Prowlarr está sem indexer.

## Containers

```yaml
radarr:       lscr.io/linuxserver/radarr:latest       # :7878
sonarr:       lscr.io/linuxserver/sonarr:latest       # :8989
prowlarr:     lscr.io/linuxserver/prowlarr:latest     # :9696
qbittorrent:  lscr.io/linuxserver/qbittorrent:latest  # :8080, 6881/tcp+udp
```

- Config em `./radarr/config`, `./sonarr/config`, `./prowlarr/config` e
  `./qbittorrent/config` (fora do git).
- `~/Midia` é montada **read-write** no Radarr/Sonarr, porque eles precisam
  importar, renomear e mover arquivos. O Jellyfin continua `:ro`.
- `${HOME}/Downloads/streamflix` é montada como `/downloads` no Radarr, Sonarr e
  qBittorrent. O qBittorrent salva em `/downloads/complete/<categoria>` e usa
  `/downloads/incomplete` para temporários.
- `PUID`/`PGID` padrão `1001:1001` (o dono de `~/Midia` nesta máquina). Ajuste
  via `.env` do compose se o seu usuário for outro.
- Portas: `7878`, `8989`, `9696`, `8080` e `8096`.

## Configuração

```bash
docker compose up -d
./scripts/setup-pipeline.sh
# reinicie o Next para carregar o .env.local
pkill -f "next start" && (cd web && npm run build && npm start)
```

O script é idempotente. Ele:

1. roda o `setup-arr.sh` (API keys do Radarr/Sonarr e root folders);
2. espera qBittorrent e Prowlarr;
3. autentica no qBittorrent (senha do `.env.local` ou a temporária do log),
   define uma senha permanente, desliga a validação de Host header, cria
   `/downloads/complete` e as categorias `radarr`/`sonarr`;
4. grava `RADARR_*`, `SONARR_*`, `QBITTORRENT_*` e `PROWLARR_*` em `web/.env.local`;
5. conecta o qBittorrent como download client no Radarr e no Sonarr (com teste);
6. conecta Radarr e Sonarr como aplicações do Prowlarr (com teste).

As credenciais do qBittorrent ficam em `web/.env.local`
(`QBITTORRENT_USERNAME` / `QBITTORRENT_PASSWORD`). A senha temporária inicial
aparece em `docker logs streamflix_qbittorrent` e deixa de valer depois do script.

Variáveis usadas pelo backend:

| Variável | Padrão | Função |
| --- | --- | --- |
| `RADARR_URL` | `http://localhost:7878` | base da API v3 |
| `RADARR_API_KEY` | — | chave do Radarr (servidor) |
| `RADARR_ROOT_FOLDER` | `/media/Filmes` | pasta raiz dos filmes |
| `SONARR_URL` | `http://localhost:8989` | base da API v3 |
| `SONARR_API_KEY` | — | chave do Sonarr (servidor) |
| `SONARR_ROOT_FOLDER` | `/media/Series` | pasta raiz das séries |
| `PROWLARR_URL` | `http://localhost:9696` | base da API v1 |
| `PROWLARR_API_KEY` | — | chave do Prowlarr (servidor) |
| `QBITTORRENT_URL` | `http://localhost:8080` | WebUI/API do downloader |
| `QBITTORRENT_USERNAME` | `admin` | usuário do qBittorrent |
| `QBITTORRENT_PASSWORD` | — | senha definida pelo script |
| `ARR_QUALITY_PROFILE` | `HD-1080p`, senão o primeiro | nome ou id do perfil |
| `ARR_TIMEOUT_MS` | `10000` | timeout das chamadas |

## API do backend

Todas as rotas são same-origin, dinâmicas (`no-store`) e nunca devolvem as
chaves.

| Rota | Método | Descrição |
| --- | --- | --- |
| `/api/arr/status` | GET | versão + saúde do Radarr e Sonarr |
| `/api/arr/search?term=...` | GET | busca filmes e séries juntos (barra do cabeçalho) |
| `/api/arr/lookup?kind=movie\|series&term=...` | GET | busca no catálogo TMDB/TVDB |
| `/api/arr/add` | POST | adiciona e monitora `{ kind, arrId }` |
| `/api/arr/library?kind=...` | GET | biblioteca normalizada (sem kind: os dois) |
| `/api/arr/library?kind=...&id=...` | DELETE | remove do *arr; `deleteFiles=true` apaga mídia |
| `/api/arr/queue?kind=...` | GET | fila com progresso em % |
| `/api/pipeline/status` | GET | versão do Prowlarr/qBittorrent, nº de indexers e torrents |

`arrId` é o **TMDB id** para filmes e o **TVDB id** para séries — os mesmos ids
que o lookup devolve. O add refaz o lookup (`tmdb:603` / `tvdb:81189`) para montar
o payload completo.

Exemplos:

```bash
# buscar
curl -s 'http://localhost:3000/api/arr/lookup?kind=movie&term=matrix'

# adicionar (The Matrix)
curl -s -X POST http://localhost:3000/api/arr/add \
  -H 'Content-Type: application/json' \
  -d '{"kind":"movie","arrId":603}'

# fila e biblioteca
curl -s 'http://localhost:3000/api/arr/queue'
curl -s 'http://localhost:3000/api/arr/library'
```

Respostas:

- `201` item criado, `200` já existia (idempotente), `400` entrada inválida,
  `404` título não encontrado, `502` erro do *arr, `503` serviço não configurado.
- `DELETE` devolve `204`.

## Decisões de implementação

- **Normalização**: Radarr usa `tmdbId`/`hasFile`/`movieFile.quality`; Sonarr usa
  `tvdbId`/`statistics.episodeFileCount`. O backend converte os dois para o mesmo
  formato (`LibraryItem`, `QueueItem`), então a UI não tem `if (radarr)`.
- **Idempotência**: antes de adicionar, compara o `arrId` com a biblioteca. Se já
  existe, devolve o item com `existed: true` em vez de duplicar.
- **Perfil**: `ARR_QUALITY_PROFILE` (nome ou id) vence; senão tenta `HD-1080p`;
  senão o primeiro perfil. Filmes entram com `minimumAvailability: released`.
- **Busca automática**: o add já manda `searchForMovie` / `searchForMissingEpisodes`
  no `addOptions`. Quando o indexador existir, não precisa clicar em "Search".
- **Root folder**: se a pasta configurada não existe no *arr, o add cria via
  `POST /rootfolder` antes de inserir o título.
- **Remoção segura**: `deleteFiles=false` por padrão. Apagar arquivo é opt-in.
- **Saúde visível**: em vez de esconder que a esteira está incompleta, a UI mostra
  os warnings reais do Radarr/Sonarr e o estado de Prowlarr/qBittorrent.
- **qBittorrent**: o script desliga `web_ui_host_header_validation_enabled` porque
  o Radarr/Sonarr acessam pelo nome de serviço (`qbittorrent:8080`), que não é
  `localhost`. As categorias `radarr`/`sonarr` apontam para
  `/downloads/complete/<categoria>`.
- **Prowlarr**: Radarr/Sonarr entram com `syncLevel: fullSync`; ao cadastrar um
  indexer no Prowlarr, ele é replicado para os dois sem configurar de novo.
  A comunicação usa os nomes de serviço (`http://radarr:7878`,
  `http://sonarr:8989`, `http://prowlarr:9696`).

## Limites e próximos passos

- **Indexers**: cadastrados em `Prowlarr → Indexers` e sincronizados com Radarr/Sonarr.
  O EZTV exige o FlareSolverr como *Indexer Proxy*; sem isso ele fica indisponível.
- **RAM**: `docker-compose.yml` limita Jellyfin a 2 GB, Radarr/Sonarr/Prowlarr/
  qBittorrent a 512 MB e FlareSolverr a 1 GB. O transcode do Jellyfin é o maior
  consumidor; prefira *direct play*.
- **Tamanho máximo**: as *Quality Definitions* do Radarr/Sonarr têm `maxSize` por
  minuto de duração. No perfil `HD-1080p`, `Remux-1080p` está desabilitado no Radarr
  e os limites são 20 MB/min (HDTV), 30 MB/min (WEB) e 40 MB/min (Bluray) — um filme
  de 2 h fica em no máximo ~4,8 GB. Sonarr usa 20/25/30 MB/min por episódio.
- **Porta 6881**: está publicada em TCP/UDP; para boa conectividade, libere/faça
  port forwarding no roteador. Sem isso o qBittorrent baixa, mas com menos peers.
- **Hardlink**: `/downloads` e `/media` são bind mounts separados, então o import
  tende a **copiar** em vez de criar hardlink. Para hardlink, monte um pai comum
  (ex.: `${HOME}:/data`) e use `/data/Midia` + `/data/Downloads/streamflix` nos três serviços.
- **Espaço em disco**: downloads e biblioteca ficam em `~/` (mesmo disco). O
  qBittorrent está com cache de 64 MiB, 100 conexões e 2 downloads ativos; os seeds
  continuam sem limite de ratio/tempo.
- **Jellyfin**: por padrão ele detecta mudanças na pasta; se não, agende um scan
  da biblioteca ou configure a conexão Radarr/Sonarr → Jellyfin (Notifications).
- **Tempo real**: a página é dinâmica, mas não tem WebSocket. Fila e biblioteca
  atualizam ao recarregar.
- **Autenticação**: `/automacao` não tem login; Prowlarr/qBittorrent têm senha,
  mas o BFF não autentica usuário. É aceitável em LAN; antes de expor na internet,
  coloque auth e CSRF no BFF e um reverse proxy com TLS.
- **Multiusuário**: um único Radarr/Sonarr para a casa. Pedidos por perfil exigiriam
  auth + tags/quotas.

## Verificação feita

- Containers: Radarr `6.4.4.10685`, Sonarr `4.0.20.3014`, Prowlarr `2.6.5.5623`,
  qBittorrent `5.2.4`, todos online.
- Lookup: `matrix` → The Matrix (TMDB 603); `breaking bad` → TVDB 81189.
- Add filme: `201` com id interno 1; repetição devolveu `200 existed:true`.
- Add série: `201`; biblioteca do Sonarr normalizada.
- Download client: `POST /api/v3/downloadclient/test` → `200` no Radarr e no Sonarr;
  clientes criados e habilitados.
- Prowlarr: `POST /api/v1/applications/test` → `200`; apps Radarr/Sonarr com
  `fullSync`.
- Saúde: os avisos de "No download client" sumiram; restam apenas os de indexer.
- Fila: vazia (sem indexer), sem erro de API.
- Delete: `204`, biblioteca voltou ao estado anterior.
- Inválidos: `kind` errado → `400`; id negativo → `400`; id inexistente → `404`.
- `tsc`, `eslint` e `next build` passaram.

## Fontes

- Radarr API v3 (openapi na instância): `http://localhost:7878/api/v3/openapi.json`
- Sonarr API v3: `http://localhost:8989/api/v3/openapi.json`
- Prowlarr API v1: `http://localhost:9696/api/v1/openapi.json`
- Servarr Wiki — Radarr/Sonarr settings, root folders, quality profiles:
  https://wiki.servarr.com/radarr/settings e https://wiki.servarr.com/sonarr/settings
- Servarr Wiki — Prowlarr (indexers e apps): https://wiki.servarr.com/prowlarr
- LinuxServer.io — imagens Radarr/Sonarr/Prowlarr/qBittorrent (PUID/PGID, volumes):
  https://docs.linuxserver.io/images/docker-radarr/,
  https://docs.linuxserver.io/images/docker-sonarr/,
  https://docs.linuxserver.io/images/docker-prowlarr/ e
  https://docs.linuxserver.io/images/docker-qbittorrent/
- qBittorrent WebUI API: https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)
- Jellyfin — bibliotecas e scan:
  https://jellyfin.org/docs/general/server/media/movies/

# Streamflix

Front estilo streaming sobre um Jellyfin local, com esteira de automação
Radarr (filmes) + Sonarr (séries).

```bash
docker compose up -d                  # Jellyfin :8096, Radarr :7878, Sonarr :8989,
                                      # Prowlarr :9696, qBittorrent :8080
./scripts/setup-pipeline.sh           # API keys, pastas e conexões da esteira
cd web && npm run build && npm start  # front em :3000
```

`npm run dev` estoura o limite de inotify desta máquina. Use build+start, ou aumente `fs.inotify.max_user_watches`.

Credenciais/tokens em `web/.env.local` (fora do git).

Mídia: `~/Midia/Series/<Série>/Season 01/<Série> S01E01.mkv` e `~/Midia/Filmes/<Filme (Ano)>/<Filme (Ano)>.mkv`.
O Jellyfin monta `~/Midia` como somente leitura; Radarr/Sonarr montam read-write
para importar e renomear.

Rotas do Jellyfin usadas (todas na spec em `:8096/api-docs/openapi.json`):
- HLS: `GET /Videos/{id}/master.m3u8`
- Progresso: `POST /Sessions/Playing` → `/Sessions/Playing/Progress` (a cada 10s, pause, seek) → `/Sessions/Playing/Stopped`; posição em ticks (1s = 10⁷)
- Linhas: `/UserItems/Resume`, `/Items?includeItemTypes=Series|Movie`, `/Shows/{id}/Episodes`

O Jellyfin só guarda posição de retomada em itens com mais de 5 min (`MinResumeDurationSeconds`) e entre 5% e 90% assistidos.

## Automação

- Barra de pesquisa na tela inicial: busca filmes e séries juntos no catálogo e
  pede em um clique, sem sair do Streamflix.
- Página: `http://localhost:3000/automacao` — acompanhar fila/biblioteca e a saúde da esteira.
- API: `/api/arr/{search,status,lookup,add,library,queue}` e `/api/pipeline/status`.
- Prowlarr (`:9696`) centraliza os indexers; qBittorrent (`:8080`) baixa com as
  categorias `radarr`/`sonarr` em `~/Downloads/streamflix`.
- Credenciais do qBittorrent e chaves das APIs ficam em `web/.env.local`.
- Os indexers ficam em **Prowlarr → Indexers** e são replicados para o Radarr/Sonarr
  por sync. A busca e o pedido saem da barra da tela inicial ou de `/automacao`.
- Consumo controlado: `docker-compose.yml` limita a RAM por serviço e as Quality
  Definitions do Radarr/Sonarr capam o tamanho dos releases (Remux fora do HD-1080p).
- Detalhes, contrato e limites: [`docs/automacao-radarr-sonarr.md`](docs/automacao-radarr-sonarr.md).

## Progresso entre dispositivos

A posição de reprodução vive no Jellyfin (por usuário e item) e é lida/gravada
por `/api/playback` e `/api/progress/:id`. Arquitetura, referências e limites:
[`docs/progresso-entre-dispositivos.md`](docs/progresso-entre-dispositivos.md).

# Progresso entre dispositivos (Continue Watching)

Como o Streamflix salva **em que episódio** e **em que segundo** você parou, e como o
computador retoma exatamente de onde o celular parou. O documento separa o que é
**observado** (código/documentação pública) do que é **inferência** (arquitetura
interna não publicada).

## TL;DR

- A posição **não fica no aparelho**. O Jellyfin é a fonte da verdade, por
  usuário e por item (`PlaybackPositionTicks`, em ticks de 100 ns).
- O player envia `start`, `progress` (a cada 10 s) e `stop` para uma rota
  **same-origin** do Next (`/api/playback`), que repassa ao Jellyfin.
- Ao abrir um episódio, o player consulta `/api/progress/:id` e faz `seek` para a
  posição mais recente do servidor antes de tocar.
- Resultado: celular para em `1:58` → computador abre em `1:58`, com o episódio
  e o tempo restante visíveis na home e na página da série.

```
CELULAR                          NEXT (BFF)                        JELLYFIN
Player ──POST /api/playback──▶ /api/playback ──POST /Sessions/Playing*──▶ UserData
   │                                │                                    │
   └─ a cada 10s, pause, seek,      └─ token fica no servidor            │
      fechar aba (sendBeacon)                                            │
                                                                         │
COMPUTADOR                                                               │
Home/Watch ──GET /api/progress/:id──▶ /api/progress/:id ──GET /Items/:id─┘
```

## O que a Netflix faz (evidência pública)

A Netflix não publica o schema interno do "Continue Watching". O que dá para
afirmar com fonte:

| Afirmação | Evidência | Tipo |
| --- | --- | --- |
| O histórico de visualização é cacheado globalmente para leitura rápida (EVCache), ao lado de ratings e recomendações | Netflix TechBlog, *Caching for a Global Netflix* | observado (blog oficial) |
| O cliente emite eventos de playback e de UI para um pipeline de logging/tracking de alto volume | Netflix TechBlog, *Scalable Logging and Tracking* | observado (blog oficial) |
| Dados de um serviço são propagados para vários consumidores via pub-sub de datasets | Netflix TechBlog, *How Netflix microservices tackle dataset pub-sub* | observado (blog oficial) |
| Eventos passam por Kafka (Keystone) e são materializados em Cassandra/S3/Iceberg/Elasticsearch | recodehive, *How Netflix Handles 2 Trillion Events Every Day* | secundário |
| A retomada é por **perfil**, não por aparelho; o aparelho é um cliente sem estado | comportamento do produto + os posts acima | inferência forte |

**Arquitetura que emerge disso (inferida):**

1. **Chave de estado**: `perfil + item` (filme ou episódio). Não existe "posição
   do celular" e "posição do computador"; existe uma posição do perfil.
2. **Escrita**: o player manda eventos (`play`, `pause`, `progress`, `stop`) com
   item, posição, sessão e dispositivo. O evento é imutável e idempotente.
3. **Ingestão**: os eventos entram em um barramento (Kafka/Keystone), passam por
   stream processing (Flink) e viram estado materializado.
4. **Leitura**: "Continue Watching" lê o estado mais recente do perfil (camada
   de cache + viewing history service) e calcula o próximo episódio.
5. **Conclusão**: posição muito no começo é ignorada; perto do fim marca como
   visto e avança para o próximo episódio.
6. **Concorrência**: o último evento válido vence; por isso o cliente relê a
   posição ao abrir o player, em vez de confiar em cache local velho.

> O que **não** dá para afirmar: nomes exatos dos serviços internos, schema das
> tabelas, TTL do cache e algoritmo de "next up". São detalhes não públicos.

## Como outros serviços resolvem

| Serviço | Fonte da verdade | Chave | O que guarda | Escrita | Leitura |
| --- | --- | --- | --- | --- | --- |
| **Netflix** | perfil na nuvem | perfil + item | posição, estado, último device | eventos de playback → pipeline | cache/estado materializado |
| **Jellyfin** | servidor | `userId` + `itemId` | `PlaybackPositionTicks` (100 ns) | `POST /Sessions/Playing`, `/Progress`, `/Stopped` | `GET /UserItems/Resume`, `GET /Items/:id` |
| **Plex** | Plex Media Server | conta + `ratingKey` | `viewOffset` (ms), `viewCount`, `lastViewedAt` | `/:/timeline` (a cada ~10 s), `/:/progress` | metadata do item / `status/sessions` |
| **Kodi** | banco local (`MyVideos*.db`) | `idFile` + perfil | `bookmark.timeInSeconds`, `totalTimeInSeconds` | player grava no banco | player lê o bookmark |
| **YouTube** | conta Google + cache local | conta + vídeo | posição no histórico | player / watch history | "Continue watching" e histórico |
| **Apple TV** | iCloud | Apple ID + item | Up Next / posição | apps + play history | Up Next sincronizado |
| **Spotify** | conta + Connect | conta + episódio | resume point de podcast | player / Connect | retomada no outro device |

Detalhes que valem copiar:

- **Jellyfin**: o servidor só guarda a posição se ela estiver entre
  `MinResumePct` (5%) e `MaxResumePct` (90%) do runtime, e se o vídeo tiver pelo
  menos `MinResumeDurationSeconds` (300 s por padrão). Fora disso, zera ou marca
  como visto. É a mesma ideia de "não poluir o Continue Watching" da Netflix.
- **Plex**: usa milissegundos (`viewOffset`), manda timeline a cada ~10 s e tem
  um endpoint separado (`/:/progress`) para gravar a posição de um item parado.
- **Kodi**: é o exemplo mais simples: uma linha na tabela `bookmark` com
  `timeInSeconds` e `totalTimeInSeconds`. Funciona local; sincronizar entre
  aparelhos exige banco compartilhado ou add-on.
- **YouTube/Apple/Spotify**: a retomada só é confiável quando os dois aparelhos
  estão na **mesma conta** e o histórico/sync está ligado. É exatamente o mesmo
  requisito do Streamflix (mesmo `JELLYFIN_USER_ID`).

## Como o Streamflix implementa

### Fonte da verdade

O Jellyfin já é um "playback state service": `UserData.PlaybackPositionTicks` é
persistido por usuário e item, e o endpoint `/UserItems/Resume` devolve os itens
em andamento. Não criamos um banco paralelo — isso evita duas verdades e mantém
a compatibilidade com o app oficial do Jellyfin, TV, etc.

### Escrita (celular, desktop, TV)

`components/Player.tsx` envia:

- `start` no primeiro `playing`;
- `progress` a cada **10 s** enquanto toca;
- `progress` em `pause` e `seeked`;
- `progress` quando a aba fica oculta (`visibilitychange`);
- `stop` em `ended`, `pagehide` e no cleanup do componente.

O `stop` final usa `navigator.sendBeacon()` para a rota same-origin. Isso evita
o preflight de CORS e o request perdido quando o navegador do celular mata a
aba. O token do Jellyfin nunca vai para o browser nessa chamada.

### Leitura (retomada)

`app/watch/[id]/page.tsx` já renderiza com `startTicks` do servidor. Além disso,
`Player` busca `GET /api/progress/:id` ao montar. Se a posição do servidor for
maior que a do HTML (ex.: você assistiu no celular depois que a página abriu),
o player faz `seek` para ela antes de começar. Isso também reduz o risco de um
device com cache velho sobrescrever a posição nova.

### Acesso na rede local (celular)

`JELLYFIN_URL` é uma URL de servidor (normalmente `http://localhost:8096`) e não
pode ir para o `<img>`/`<video>` do browser: no celular, `localhost` é o próprio
celular. Por isso `publicJfUrl(host)` monta a base que o **cliente** deve usar:

- se `JELLYFIN_PUBLIC_URL` estiver definido, ele manda;
- se `JELLYFIN_URL` for loopback (`localhost`, `127.0.0.1`, `::1`), troca o host
  pelo host da requisição (ex.: `10.0.0.11`) e mantém a porta `8096`;
- caso contrário, usa a origem configurada.

As páginas passam essa base para `imageUrl`, `previewUrl` e para o `Player`. O
`/api/playback` continua same-origin, então funciona igual em `localhost` ou no
IP da LAN.

### UI

- **Home**: a linha "Continuar assistindo" mostra série, `T1E2`, "parou em
  1:58" e "4 min restantes", com barra de progresso.
- **Série**: um banner "Continuar de onde parou" aponta para o episódio mais
  recente em andamento; cada episódio mostra posição, tempo restante e "✓
  assistido".

### Contrato dos endpoints

`POST /api/playback`

```json
{
  "event": "start | progress | stop",
  "itemId": "cb3cb8a37719f8f60d4e0cababf2b257",
  "positionTicks": 1800000000,
  "isPaused": true,
  "playSessionId": "opcional",
  "mediaSourceId": "opcional"
}
```

`GET /api/progress/:id`

```json
{
  "itemId": "cb3cb8a37719f8f60d4e0cababf2b257",
  "positionTicks": 1800000000,
  "playedPercentage": 49.99,
  "played": false,
  "runtimeTicks": 3600230000,
  "name": "Serie Teste S01E03",
  "seriesName": "Serie Teste",
  "season": 1,
  "episode": 3
}
```

### Regras e limites

- **Último write vence**. Não há relógio vetorial nem número de sequência. A
  releitura antes do play cobre o caso comum (device que ficou aberto).
- **Curtos demais não retomam**: vídeos com menos de 5 min são marcados como
  vistos pelo Jellyfin (`MinResumeDurationSeconds = 300`).
- **Começo/fim**: abaixo de 5% ou acima de 90% a posição é zerada; acima de 90%
  marca como visto. Configurável no Jellyfin.
- **Offline**: se a rede cair no exato momento do `stop`, a última posição pode
  se perder. Próximo passo natural: fila em IndexedDB + reenvio no próximo
  `online`.
- **Multiusuário**: o app usa um único `JELLYFIN_USER_ID` no `.env.local`. Para
  perfis de verdade, trocar por login por usuário e usar o token da sessão.
- **Tempo real**: uma home já aberta não se atualiza sozinha quando outro device
  grava; ela atualiza ao navegar/recarregar (ou via WebSocket do Jellyfin, se
  quisermos depois).

## Verificação feita

Simulação de "celular grava, computador lê" usando a API nova:

```bash
ITEM=cb3cb8a37719f8f60d4e0cababf2b257
BASE=http://localhost:3000

curl -s -X POST "$BASE/api/playback" -H 'Content-Type: application/json' \
  -d "{\"event\":\"progress\",\"itemId\":\"$ITEM\",\"positionTicks\":1800000000,\"isPaused\":true}"

curl -s "$BASE/api/progress/$ITEM"
# positionTicks: 1800000000  (3:00 de 6:00)
```

O retorno de `GET /api/progress/:id` confirmou `positionTicks = 1800000000` e
`playedPercentage ≈ 50%`; a home e a página da série passaram a exibir "parou
em 3:00 · 3 min restantes" para o episódio.

Também foi verificado o acesso como celular na LAN, simulando o host:

```bash
curl -H 'Host: 10.0.0.11:3000' http://localhost:3000/
# imagens e vídeo apontam para http://10.0.0.11:8096/...
```

## Arquivos

- `web/app/api/playback/route.ts` — escrita same-origin → Jellyfin.
- `web/app/api/progress/[id]/route.ts` — leitura da posição atual.
- `web/components/Player.tsx` — heartbeat, seek de retomada, sendBeacon.
- `web/components/ContinueWatching.tsx` — card com episódio/tempo restante.
- `web/app/series/[id]/page.tsx` — banner e progresso por episódio.
- `web/lib/jellyfin.ts` — `reportPlayback`, `getProgress`, `publicJfUrl`, tipos.
- `web/lib/format.ts` — ticks → `1:58`, `4 min`.

## Fontes

**Netflix**

- Netflix TechBlog — *Caching for a Global Netflix*:
  https://netflixtechblog.com/caching-for-a-global-netflix-7bcc457012f1
- Netflix TechBlog — *Scalable Logging and Tracking*:
  https://netflixtechblog.com/scalable-logging-and-tracking-882bde0ddca2
- Netflix TechBlog — *How Netflix microservices tackle dataset pub-sub*:
  https://netflixtechblog.com/how-netflix-microservices-tackle-dataset-pub-sub-4a068adcc9a
- recodehive — *How Netflix Handles 2 Trillion Events Every Day* (secundário,
  Keystone/Kafka/Cassandra): https://www.recodehive.com/blog/netflix-data-engineering

**Jellyfin**

- `PlaystateController.cs` (`Sessions/Playing`, `/Progress`, `/Stopped`):
  https://github.com/jellyfin/jellyfin/blob/master/Jellyfin.Api/Controllers/PlaystateController.cs
- `UserDataManager.cs` (regras de 5%/90% e duração mínima):
  https://github.com/jellyfin/jellyfin/blob/master/Emby.Server.Implementations/Library/UserDataManager.cs
- `ServerConfiguration.cs` (`MinResumePct`, `MaxResumePct`,
  `MinResumeDurationSeconds`):
  https://github.com/jellyfin/jellyfin/blob/master/MediaBrowser.Model/Configuration/ServerConfiguration.cs
- API docs: https://api.jellyfin.org

**Plex**

- `viewOffset` em ms e `/:/timeline` a cada 10 s:
  https://github.com/marius-vezelis/mpv-plex-scrobbler
- Gravação de resume via `PUT /:/progress?...&time={ms}&state=stopped`:
  https://github.com/IanWorley/Continuarr/issues/125

**Kodi**

- Tabela `bookmark` (`timeInSeconds`, `totalTimeInSeconds`):
  https://kodi.wiki/view/Databases/MyVideos
- Bookmarks e retomada: https://kodi.wiki/view/Bookmarks_and_chapters

**YouTube / Apple / Spotify**

- YouTube "Continue watching" e requisito de mesma conta:
  https://9to5google.com/2021/10/03/youtube-continue-watching/
- Apple TV Up Next sincronizado com a mesma conta Apple:
  https://discussions.apple.com/thread/252324338
- Spotify: progresso de podcast entre devices:
  https://community.spotify.com/t5/Other-Podcasts-Partners-etc/Podcasts-Sync-podcast-progress-across-all-devices/td-p/5385697
- Spotify Connect / retomada cross-device (secundário):
  https://www.pocket-lint.com/youtube-music-cross-device-playback/

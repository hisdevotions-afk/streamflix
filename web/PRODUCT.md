# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Uma família em casa, na rede local. Assistem na TV/notebook e no celular, e trocam de aparelho no meio de um episódio.

## Product Purpose
Streamflix é a sala de cinema caseira sobre um servidor Jellyfin local: navegar pela biblioteca da família, apertar play e retomar exatamente de onde parou em qualquer aparelho.

## Positioning
Não é um catálogo de serviço: é a biblioteca da própria casa. O Jellyfin é a fonte de verdade do progresso, então "Continuar assistindo" vale entre aparelhos.

## Capabilities and Constraints
- Next 15 (App Router) + Tailwind 4 + video.js; dados vêm do Jellyfin via `lib/jellyfin.ts`.
- Rotas: início, `/series/[id]`, `/watch/[id]`, `/automacao` (fora do escopo visual).
- Progresso salvo a cada 10 s; retomada ignorada em itens < 5 min (comportamento do Jellyfin).
- `npm run dev` falha por limite de inotify: usar `build` + `start`.
- Acesso por IP da LAN; mídia servida direto do Jellyfin pelo host da requisição.

## Evidence on Hand
Biblioteca atual é de teste: "Filme Teste (2024)" (com imagem Primary extraída do vídeo) e "Serie Teste" (3 episódios, sem arte). Sem backdrops, gêneros ou sinopses. O layout precisa ficar bom com metadados escassos; nunca inventar títulos ou arte.

## Product Principles
- Apertar play é sempre a ação mais próxima.
- Retomada visível: posição salva e tempo restante aparecem onde o item aparece.
- Funciona igual no sofá (TV/notebook) e no celular.
- Só controles que funcionam de verdade.

---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/series/[id]/page.tsx","app/watch/[id]/page.tsx"]
---

# Surface: início + série + player

Scope: home (app/page.tsx), série (app/series/[id]), moldura do player (app/watch/[id]). Mode: Experience. /automacao fora do escopo.
Audience: família em casa (LAN), sofá + celular. Job: escolher e apertar play / retomar.
Direction pinned by the user: Dribbble shot "John Wick" streaming tablet UI (rail lateral de ícones circulares, busca em pílula, hero sangrado à direita, título gigante, pílulas Assistir/Trailer, faixa de miniaturas com indicador, ações circulares no canto). Build path: code-led (sem geração de imagem).

## Direction contract
THESIS: a casa é uma sala de projeção de uma tela só; o hero é a obra em cartaz e a faixa de miniaturas é o projetor trocando o rolo. Recusa o template Netflix de banner + fileiras de cards iguais como primeira leitura.
OWN-WORLD: noite índigo-violeta (#0b0a1a → #1c1640) com névoa violeta à esquerda, imagem sangrando à direita; branco puro para título e ação primária; pílulas e círculos de vidro fosco apenas como controles; Urbanist pesado e apertado no display; violeta #8b7cff só para progresso e foco.
STORY: entende o que está em cartaz, vê onde parou, aperta Assistir; troca o destaque pela faixa; desce para Continuar/Séries/Filmes.
FIRST VIEWPORT: rail de 76px à esquerda (logo, Início, Continuar, Séries, Filmes, Automação); pílula de busca no topo direito; à esquerda 45%: título 5-6rem, linha única tipo·ano·episódio/duração abaixo, pílulas Assistir (branca) + Episódios/Detalhes (contorno); embaixo à esquerda a faixa de miniaturas com barra de tempo; canto inferior direito: favoritar. Vídeo/arte ocupa a direita, sangrando.
FORM: referência pinada pelo usuário; seed: 8e46e008 (roll executado; a direção pinada pelo usuário vence o roll). Motion: troca de destaque = cortina de máscara + escala lenta do vídeo, título revelado linha a linha; cards de pôster inclinam/elevam com spring e revelam progresso; rotas entram com fade+desfoque curto.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

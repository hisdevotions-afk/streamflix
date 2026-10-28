---
name: Streamflix
description: Sala de projeção caseira sobre o Jellyfin da família.
colors:
  night: "#0b0a1a"
  dusk: "#151231"
  haze: "#241d52"
  hero-dusk: "#1c1640"
  scrim-indigo: "#141136"
  iris: "#8b7cff"
  iris-soft: "#b9b0ff"
  mist: "#c9c5e6"
  moon-white: "#f4f3ff"
  white: "#ffffff"
  glass: "rgb(255 255 255 / 0.08)"
  glass-line: "rgb(255 255 255 / 0.14)"
typography:
  display:
    fontFamily: "Urbanist, sans-serif"
    fontSize: "clamp(2.75rem, 7vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Urbanist, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Urbanist, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.55
  body:
    fontFamily: "Urbanist, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "Urbanist, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.55
  label:
    fontFamily: "Urbanist, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
rounded:
  md: "6px"
  xl: "12px"
  2xl: "16px"
  3xl: "24px"
  full: "9999px"
spacing:
  gutter-mobile: "20px"
  gutter-desktop: "56px"
  card-gap: "16px"
  row-gap: "40px"
  rail-width: "76px"
components:
  button-primary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.night}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 28px 0 20px"
    height: "48px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    rounded: "{rounded.full}"
    padding: "0 28px"
    height: "48px"
  button-glass:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.white}"
    rounded: "{rounded.full}"
    padding: "0 20px 0 16px"
    height: "44px"
  icon-circle:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.mist}"
    rounded: "{rounded.full}"
    size: "44px"
  search-pill:
    backgroundColor: "rgb(11 10 26 / 0.6)"
    textColor: "{colors.white}"
    rounded: "{rounded.full}"
    height: "48px"
    width: "22rem"
  poster-card:
    backgroundColor: "{colors.dusk}"
    textColor: "{colors.moon-white}"
    rounded: "{rounded.2xl}"
    padding: "16px"
    width: "19rem"
  resume-badge:
    backgroundColor: "{colors.iris}"
    textColor: "{colors.night}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: Streamflix

## Overview

**Creative North Star: "A Sala de Projeção de Uma Tela Só"**

A casa é uma sala escura com uma única obra em cartaz. O hero ocupa a viewport inteira: noite índigo-violeta à esquerda, onde uma névoa violeta respira atrás do título, e a imagem ou vídeo sangrando pela direita a partir de 28% da largura. A faixa de miniaturas embaixo é o projetor trocando o rolo, com uma barra de tempo branca que avança. Só depois disso a página desce para as fileiras.

A densidade é baixa e a hierarquia é brutalmente simples: um título gigante em caixa alta, uma linha de metadados, uma pílula branca para apertar play. Todo o resto (rail, busca, favoritar, voltar) é vidro fosco em pílula ou círculo, recuado para não competir com a obra. A cor é quase toda noite; o violeta aparece só onde diz "você está aqui".

O sistema precisa ficar bom com metadados escassos: sem arte, a peça cai para um bloco `haze` com o título, nunca para arte inventada.

**Key Characteristics:**
- Fundo noite índigo, imagem sangrando à direita, gradiente-cortina da esquerda.
- Display Urbanist 800 em caixa alta, apertado, revelado linha a linha.
- Branco puro só para título e ação primária.
- Controles secundários são vidro fosco em pílula ou círculo.
- Violeta (iris) reservado para progresso, retomada, posição atual e foco.
- Movimento com curva de chegada confiante, sem overshoot, exceto o "pop" do favoritar.

## Colors

Uma noite índigo-violeta quase monocromática, com branco para a ação e um único violeta de sinalização.

### Primary
- **Iris Projector Violet** (iris): barras de progresso (pôster, episódio, player video.js), selo "Retomar", o quarto ponto do logo, o halo do item ativo no rail e a cor de seleção de texto. Nunca é fundo de botão de ação.
- **Soft Iris** (iris-soft): anel de foco global (2px, offset 3px) e o check de episódio assistido.

### Neutral
- **Night** (night): fundo do corpo, do player e das camadas de escurecimento; texto sobre a pílula branca.
- **Dusk** (dusk): fundo de cartão e miniatura antes da imagem carregar; popover de busca (95%) e tooltips do rail.
- **Haze** (haze): fallback de arte ausente e cor da barra de rolagem.
- **Hero Dusk** (hero-dusk) e **Indigo Scrim** (scrim-indigo): paradas do gradiente de 160° do palco (hero-dusk → #121033 → night) e do véu horizontal que cobre a imagem pela esquerda. Usados igual no hero da home e no da série.
- **Mist** (mist): todo texto secundário (metadados, sinopse, placeholders, ícones inativos do rail).
- **Moon White** (moon-white): cor de texto padrão do corpo.
- **Pure White** (white): título display, pílula primária, botão de play circular nos cartões, miniatura ativa da faixa e barra de tempo do rolo.
- **Glass** / **Glass Line** (glass, glass-line): preenchimento e contorno de 1px de todo controle de vidro fosco.

### Named Rules
**The Iris Means Here Rule.** Iris marca só posição: progresso, retomada, item atual, foco. Se o elemento não responde "onde eu estou?", ele não é violeta.

**The One White Action Rule.** Por bloco há uma única pílula branca sólida, e ela é sempre play/retomar. Ações secundárias são contorno ou vidro.

## Typography

**Display Font:** Urbanist (via next/font, pesos 400-800)
**Body Font:** Urbanist

**Character:** Uma geométrica única, pesada e apertada no topo, macia e legível no resto. Contraste vem de peso e tamanho, não de pareamento.

### Hierarchy
- **Display** (800, clamp(2.75rem, 7vw, 6rem), 0.95, -0.035em, caixa alta, text-balance): título da obra no hero. Na página de série a mesma receita roda em clamp(2.5rem, 6vw, 5rem). Revelado palavra a palavra subindo de uma máscara.
- **Headline** (700, 1.25rem mobile / 1.5rem desktop, tracking-tight): título de fileira e de seção ("Continuar assistindo", "Episódios").
- **Title** (700, 1.125rem): nome no cartão de pôster e na linha de episódio.
- **Meta** (500, 1.125rem a 1.25rem): a linha única tipo · ano · episódio/duração abaixo do display.
- **Body** (400, 1rem, sinopse limitada a 56-60ch, cor mist).
- **Label** (600-700, 0.875rem): texto de pílula e botão; 0.75rem para tooltips e linhas secundárias de resultado.

### Named Rules
**The Shout Once Rule.** Caixa alta e tracking negativo pertencem só ao display. Títulos de seção e cartões ficam em caixa normal.

**The Tabular Clock Rule.** Códigos de episódio e tempos usam números tabulares.

## Layout

Rail fixo de 76px à esquerda no desktop (md, 768px+), que vira barra inferior translúcida no mobile (o conteúdo ganha 80px de respiro embaixo). Calha lateral de 20px no mobile e 56px no desktop.

O hero da home é 100svh (mín. 600px, máx. 1100px). A imagem ocupa de 28% até a borda direita no desktop e a tela inteira no mobile. O bloco de texto fica embaixo à esquerda, até min(40rem, 92vw), ancorado acima da faixa de miniaturas; a busca em pílula fica no topo direito, o favoritar no canto inferior direito.

Abaixo do hero, fileiras com 40px entre si, cada uma um carrossel horizontal com snap e 16px entre cartões, sangrando pela borda direita. Cartões têm 19rem (62vw no mobile); a fileira "Continuar assistindo" usa cartões largos de 26rem (78vw).

Página de série: palco de 62svh com o mesmo gradiente e véu, texto em até 48rem, lista de episódios em até 56rem. Player: tela cheia preta, só um botão de voltar em vidro e o título no topo.

## Elevation & Depth

A profundidade vem de camadas de luz, não de cartões empilhados: gradiente de palco, véu índigo da esquerda, gradiente de chão (night subindo), a névoa violeta desfocada e vidro fosco com backdrop-blur. Sombras são suaves, deslocadas para baixo e com espalhamento negativo; não há sombras duras.

### Shadow Vocabulary
- **Projector Glow** (`box-shadow: 0 10px 30px -10px rgb(255 255 255 / 0.45)`, hover `0 14px 40px -8px rgb(255 255 255 / 0.6)`): só a pílula branca primária. Ela emite luz.
- **Poster Drop** (`box-shadow: 0 18px 40px -24px rgb(0 0 0 / 0.9)`, hover `0 28px 60px -20px rgb(0 0 0 / 0.95)`): cartões de pôster, crescendo junto com o levantar.
- **Popover Drop** (`box-shadow: 0 24px 60px -20px rgb(0 0 0 / 0.8)`): painel de resultados da busca.
- **Iris Halo** (`box-shadow: 0 6px 20px -6px rgb(139 124 255 / 0.7)`): bolha do item ativo do rail.

### Named Rules
**The Light Not Lift Rule.** Elementos escuros afundam com sombra preta; só a ação primária brilha. Nada flutua com sombra colorida, exceto a marca de posição do rail.

## Shapes

Duas famílias de forma. Controles são pílulas e círculos perfeitos (9999px), sem exceção: rail, busca, botões, favoritar, play, selos, barras de progresso. Conteúdo são retângulos de cantos suaves: cartões e linhas de episódio 16px, miniatura de episódio 12px, miniaturas da faixa e pôsteres de resultado 6px, popover 24px. Contornos são sempre 1px glass-line via ring, nunca bordas grossas.

## Components

### Buttons
Pílulas confiantes de 48px que comprimem a 0.96 no toque (spring snappy).
- **Primary:** branco, texto night 700, ícone de play preenchido que desliza 2px no hover, Projector Glow.
- **Outline:** transparente com anel branco 45%, texto 600; no hover ganha 10% de branco e anel cheio.
- **Glass:** 44px, glass + glass-line + blur médio; usado para voltar e controles flutuantes. No player o fundo é night 50%.
- **Icon circle:** 44-48px, mesma receita de vidro; ativo vira branco sólido com ícone night (favoritar, com spring pop).

### Chips
- **Resume badge:** pílula iris com texto night 11px 700 ("Retomar"), só na linha do episódio retomável.

### Cards / Containers
- **Poster card:** 16:10, 16px, fundo dusk, anel glass-line, Poster Drop. Gradiente night de baixo para cima segura título (title) e linha mist. Inclina em 3D seguindo o cursor (spring tilt), levanta 6px e escala 1.035 no hover (spring gentle), com brilho radial branco 16% seguindo o cursor e um play branco circular no canto superior direito. Progresso iris de 4px se preenche ao entrar.
- **Episode row:** linha 16px com miniatura 16:9 de 12px; hover 6% de branco; a linha retomável tem 7% de branco e anel iris 50%. Hover escala a miniatura 1.1 e revela play branco circular.

### Inputs / Fields
- **Search pill:** 48px, night 60%, anel glass-line, blur forte, ícone mist. Foco interno sobe para night 75% e anel branco 40%. Resultados abrem num popover dusk 95% de 24px com linhas de 16px; a linha do cursor de teclado recebe 10% de branco.

### Navigation
- **Rail:** vidro night 40% (80% no mobile) com blur forte e linha glass-line. Itens são círculos de 44px em glass com ícone mist 18px; hover escala o disco 1.1. O ativo é uma bolha branca 18% com Iris Halo que desliza entre itens com layout spring. Tooltip em pílula dusk à direita no desktop.

### Hero Reel (signature)
O palco: troca de destaque a cada 9s (pausa com movimento reduzido). A nova imagem entra numa cortina de máscara da direita com escala lenta; o título sobe palavra a palavra (0.6s, 70ms entre palavras); metadados e ações entram em fade de 8px. Miniaturas de 60×72 (70×84 no desktop) com anel branco de 2px na ativa; abaixo, barra de 3px branca sobre 15% que mede o tempo do rolo.

### Motion
Uma curva de assinatura `cubic-bezier(0.16, 1, 0.3, 1)` (sem overshoot) para chegadas; `(0.4, 0, 1, 1)` para saídas. Durações 80/180/350/600/900ms. Rotas entram com fade e desfoque de 8px. Listas entram em cascata de 40ms, limitada a 400ms. Todo movimento respeita prefers-reduced-motion. Nada anima na primeira pintura do servidor.

## Do's and Don'ts

### Do:
- **Do** pôr a pílula branca de play como a ação mais próxima de qualquer obra.
- **Do** mostrar posição salva onde o item aparece: barra iris e "parou em · restantes".
- **Do** sangrar a imagem pela direita e cobrir a esquerda com o véu índigo (scrim-indigo) para o texto.
- **Do** usar vidro fosco (glass + glass-line + backdrop-blur) para todo controle que não é a ação primária.
- **Do** puxar durações, curvas e springs de lib/motion.ts; nunca inline.
- **Do** cair para um bloco haze com o título quando não houver arte.

### Don't:
- **Don't** usar iris como fundo de botão de ação ou decoração; ele é só marcador de posição e foco.
- **Don't** usar mais de uma pílula branca sólida por bloco.
- **Don't** abrir uma página com banner + fileiras de cards iguais como primeira leitura; a obra em cartaz vem antes.
- **Don't** usar caixa alta ou tracking negativo fora do display.
- **Don't** inventar títulos, sinopses ou arte para preencher metadados ausentes.
- **Don't** usar o vermelho e as bordas de 8px da tela /automacao; ela é legado fora do sistema.

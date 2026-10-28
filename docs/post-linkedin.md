Os streamings ficaram parecidos entre si: a mesma tela inicial, o mesmo "continuar assistindo", o mesmo player. Resolvi desmontar como isso funciona e reconstruir a experiência por conta própria, pra rodar dentro de casa. ↴

A engenharia reversa começou pelo uso. Antes de escrever código, anotei o que um serviço desses faz quando você aperta play, troca de aparelho ou volta a uma série dias depois. Cada comportamento virou uma regra do sistema:

→ Retomada entre aparelhos: o player avisa o servidor a cada 10 segundos onde você está, na mesma cadência que apps como o Plex usam. Ao abrir em outra tela, o vídeo começa desse ponto e mostra quanto falta.

→ Vídeo adaptado ao aparelho: o filme é entregue em pedaços via HLS, como nos serviços grandes, e convertido na hora quando o celular ou o navegador não aceita o formato original.

→ Lógica de série: ao abrir uma série, o sistema escolhe o episódio que você deixou pela metade mais recentemente. Se não houver, vai pro próximo que você ainda não viu.

→ Tela inicial: os destaques trocam sozinhos e pausam quando a aba perde o foco ou o destaque sai da tela, pra não puxar vídeo à toa.

→ Biblioteca: capa, sinopse e elenco são buscados na web a partir do nome do arquivo, já em português.

→ Instalável: abre pelo navegador em qualquer aparelho da rede e pode ser instalado como app (PWA).


🛠️  Stack utilizada: Next.js 15 (App Router e Server Components), React 19, TypeScript, Tailwind CSS 4, Motion, video.js com streaming HLS, servidor de mídia em Docker e PWA.

----------------


#EngenhariaReversa #DesenvolvimentoWeb #NextJS #SelfHosted

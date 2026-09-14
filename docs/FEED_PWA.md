# Extensão Feed + PWA

## Feed

- Nova rota `/feed` para OWNER, BARBER e CLIENT.
- OWNER e BARBER podem publicar fotos; CLIENT é somente leitura.
- Imagens aceitas: JPG, PNG e WEBP, até 8 MB.
- O bucket `feed-posts` é privado e usa caminhos `barbershop_id/user_id/uuid.ext`.
- A leitura é limitada a membros ativos da mesma barbearia.
- O autor pode apagar a própria publicação; OWNER pode moderar publicações do tenant.
- O banco guarda `author_name` como snapshot de exibição para que clientes consigam identificar inclusive publicações do OWNER sem ampliar a visibilidade da tabela de memberships.
- A migration adicionada é `supabase/migrations/202609130005_feed.sql`.

## PWA

- `public/manifest.webmanifest` com identidade FIO.
- Ícones 192 e 512 em `public/icons/`.
- `public/sw.js` com cache apenas do shell/recursos estáticos; `/api` nunca é cacheada.
- Registro do service worker apenas em produção, com atualização automática do worker.
- Metadados para instalação mobile e Apple Web App no `index.html`.

## Texturas FIO

As duas texturas fornecidas foram preservadas em:

- `public/textures/fio-pattern-dark.png`
- `public/textures/fio-pattern-light.png`

Elas aparecem com baixa opacidade no workspace/sidebar e como recurso visual do feed, para não competir com textos e controles.

## Validação

Foram adicionados dois cenários automatizados para o Feed (RLS/tenant e bloqueio de CLIENT na API). Nesta sessão a instalação das dependências ficou incompleta por limitação do ambiente, então a suíte completa e o build devem ser reexecutados com:

```sh
npm ci
npm run typecheck
npm run test
npm run build
```

Não use os artefatos `dist` antigos: eles foram removidos do pacote desta extensão para evitar servir uma versão anterior do frontend.

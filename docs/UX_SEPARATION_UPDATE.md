# FIO — separação de experiências e UX mobile

Atualização de 14/09/2026.

## Entradas
- `/acesso/gestao`: acesso destinado ao responsável da barbearia.
- `/acesso/equipe`: acesso destinado à equipe.
- `/b/:slug`: página pública da barbearia para clientes e links de Instagram.
- `/login?shop=:slug&audience=client`: login/cadastro do cliente já vinculado ao identificador da barbearia.

As URLs são conveniência de experiência. Autorização continua sendo validada por autenticação, tenant, role e RLS.

## PWA
- FIO Gestão usa `manifest-owner.webmanifest`.
- FIO Equipe usa `manifest-staff.webmanifest`.
- Cliente autenticado usa `manifest-client.webmanifest`.
- A página pública usa manifesto dinâmico por barbearia em `/api/public/manifest/:slug`.
- Ícones 192/512 foram regenerados em formato quadrado sem esticar a arte original.
- Splash interno usa `public/branding/fio-mark.png` sobre `#000000`.

## Contato e WhatsApp
A migration `202609140001_experience_profiles_reviews.sql` adiciona telefone em clientes/membros.
Clientes no painel abrem um perfil compacto e, quando há telefone, exibem botão direto para WhatsApp.

## Equipe
O responsável pode criar um acesso de profissional com nome, e-mail, telefone e senha inicial.
A senha é enviada ao Supabase Auth e não é armazenada nas tabelas do FIO.
Essa rota exige `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor.

## Avaliações
Após um atendimento concluído, o cliente recebe uma avaliação pendente de 1 a 5 estrelas e comentário opcional.
A avaliação fica vinculada ao atendimento e ao profissional registrado no atendimento. Há unicidade por atendimento.

## Tema
O app agora alterna tema escuro/claro. O tema claro usa `fio-pattern-light.png`; o escuro usa `fio-pattern-dark.png`.
A escolha fica salva em `localStorage`.

## Personalização pública
O responsável pode configurar nome público, descrição, URL de logo e URL de capa. A página `/b/:slug` mostra apenas dados sanitizados retornados pelo servidor.

## Antes de testar em produção
1. Aplicar a nova migration no Supabase.
2. Garantir `SUPABASE_SERVICE_ROLE_KEY` apenas nas variáveis do servidor/Vercel.
3. Rodar `npm install`, `npm run typecheck`, `npm run build` e `npm test`.
4. Testar os três links em Android/Chrome e no navegador interno do Instagram.

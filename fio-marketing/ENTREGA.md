# Entrega — 29/09/2026

**Referência:** FIO-PROJETO-PARA-ASTRA-20260929.zip, pasta finalfio1.
O aplicativo original não foi alterado. Este projeto não acessa banco, APIs ou autenticação.

**Usado e confirmado no código:** agenda por dia/profissional e status de atendimento
(`src/pages/Workspace.tsx`, `src/components/BookingFlow.tsx`); página pública, identidade,
serviços, profissionais, contato, localização e instalação PWA (`PublicPortal.tsx`);
modo solo (`OwnerOnboarding.tsx`); atualização automática (`src/App.tsx`).
Prévia com dados e estabelecimentos fictícios, identificada como demonstração.

**Planos:** valores exatos de `shared/fio-plans.ts`, replicados em `src/data/plans.ts`.
FREE/PRO/PLUS/PREMIUM ativos no catálogo, períodos semanal/mensal/anual.
PREMIUM mantém a capacidade do contrato atual; não foram inventados limites numéricos.
Teste PRO de 14 dias confirmado em `FioPlans.tsx`, `/api/saas/trial` e
`20260920081758_release_readiness_guards.sql`: uma vez por barbearia no FREE.
O FAQ de cancelamento acompanha o comportamento de `FioPlans.tsx`, sem criar garantias.

**Omitido:** promessas de IA (habilitação em produção não verificada), financeiro como
produto, publicação em lojas de aplicativos, WhatsApp automático e números de clientes
ou depoimentos não comprovados. NFC aparece apenas como projeto futuro, sem compra.
Não foi prometido tempo de configuração nem agendamento sem conta/instalação.

**Configurar para lançamento:**
- `usefio.com.br`: apontar para este projeto; `www` redireciona ao domínio sem www.
- `app.usefio.com.br`: apontar separadamente para o SaaS; ajustar `VITE_FIO_APP_URL` e reconstruir.
- `agenda.usefio.com.br/{slug}`: depende de configuração futura no aplicativo; este site não a implementa.
- Preencher `VITE_FIO_INSTAGRAM_URL` e `VITE_FIO_CONTACT_URL` com canais oficiais.
- `/termos` e `/privacidade` são páginas explicitamente pendentes, com `noindex`.
  Publicar os documentos aprovados antes do lançamento comercial. `/contato` informa o suporte interno.
- Canonical, sitemap e metadados já usam `https://usefio.com.br`; não há imagem social inventada.

**Validação:** TypeScript, build e navegador nas larguras 320, 360, 375, 390, 412,
430, 768, 1024, 1366, 1440 e 1920; preços nos três períodos, menu com Escape/foco,
FAQ, expansão dos planos, personalização e rotas informativas. Sem overflow horizontal.
Não houve teste de contratação ou do serviço em produção: o marketing apenas direciona ao app.

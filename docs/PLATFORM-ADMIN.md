# FIO Platform — entrega da etapa

Implementado sobre o `fio-saas-v2-CONSOLIDADO.zip`, na pasta existente. O `.env` e as nove migrations anteriores foram preservados e conferidos por SHA-256. Nenhum usuário Auth foi criado e nenhuma migration foi aplicada remotamente nesta etapa.

## O que está pronto

- Acesso dedicado `/acesso/plataforma` e painel `/platform`, independente de memberships. Autenticação pelo Supabase; autorização por registro ativo em `platform_admins`, sem e-mail, senha ou user_metadata como critério.
- Visão geral com contagens reais de barbearias, assinaturas e pendências. Receita SaaS indisponível enquanto não houver cobrança real. Assinaturas gratuitas também entram na contagem de assinaturas ativas, conforme indicado na tela.
- Barbearias com pesquisa, filtros de status, logo, responsável, plano e última atividade. Detalhes divididos em Resumo, Equipe, Clientes, Agenda, Financeiro, Assinaturas de cortes, Avaliações e Atividade.
- Edição de nome administrativo, suspensão/reativação, plano e status da assinatura FIO, sempre com confirmação e audit transacional. A suspensão bloqueia operações via RLS/RPC, novos vínculos e o portal público; não apaga dados ou usuários.
- Catálogo SaaS separado dos planos de cortes, com preço, disponibilidade, features/limites e períodos. Preços pagos anteriores não foram inventados. O catálogo pode ser editado sem disparar cobrança.
- Atividade com período, busca de barbearia/usuário por nome, papel/tipo e paginação. Listas usam 25 registros por página, máximo 50 na API; buscas auxiliares retornam até 25 resultados por termo.
- Audit compatível com os eventos antigos, enriquecido com ator, papel, entidade, descrição e metadata restrita. Inclui ações de agendamento, recebimentos, equipe, cadastros, serviços, avaliações e alterações administrativas. Eventos históricos mantêm papel UNKNOWN quando não há evidência histórica confiável.
- Manifest próprio FIO Platform, ícones existentes sem deformação, layout monocromático compacto, menu inferior no celular e sidebar pequena no desktop. Código do painel carregado sob demanda.
- A API da Vercel continua serverless. Apenas a rota `/platform/:path*` foi adicionada aos rewrites explícitos; `/api` não foi colocado no fallback SPA.

## Migration e arquivos

Nova migration: `supabase/migrations/20260915004746_platform_admin.sql` (gerada com a CLI oficial).

Cria `platform_admins`, `saas_plans`, schema privado `fio_private`, views com `security_invoker`, RPCs e policies explícitas. Estende `saas_subscriptions` e `audit_events`; mantém os campos legados `plan`, `expires_at`, `actor_id`, `action` e `target_id` compatíveis.

O teste de provisionamento expôs o escape incorreto no regex de telefone do consolidado. A correção está somente na nova migration, com constraints `NOT VALID`: dados históricos ficam preservados e novas gravações já são validadas. A validação do conjunto histórico pode ser feita posteriormente após revisão dos contatos existentes.

Arquivos principais: `server/platform.ts`, `shared/platform.ts`, `src/pages/Platform.tsx`, `src/pages/platform.css`, `src/App.tsx`, `server/app.ts`, `vercel.json`, `public/manifest-platform.webmanifest` e `tests/platform.test.ts`. Fixtures de navegador estão em `tests/fixtures`; não entram no bundle de produção.

## Validação realizada

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | Passou |
| `npm run build` | Processo nativo do esbuild bloqueado pelo ambiente Windows: EPERM |
| `npm run build:portable` | Passou: frontend e TypeScript do backend |
| `npm test` | Mesmo bloqueio de processo nativo: EPERM |
| `npm run test:portable` | **54 testes passaram**: 21 existentes de banco, 10 existentes de API/segurança e 23 novos |
| Interface | Navegador integrado: desktop e viewport 390×844, navegação, abas, login, estados vazios, formulário e confirmação de suspensão; sem erros de console na fixture compilada |
| Preservação | `.env` e nove migrations anteriores conferidos por hash |

Os testes SQL executaram todas as migrations em PGlite, incluindo atualização de dados preexistentes, acesso global sem membership, isolamento OWNER/BARBER/CLIENT, revogação imediata do admin, suspensão/reativação, rollback, confirmação, troca de plano e atribuição de audit a OWNER/BARBER/CLIENT/PLATFORM_ADMIN. Testes HTTP cobrem admin permitido, papéis tenant 403, anon 401 e rejeição de payload inválido.

A inspeção visual utilizou dados sintéticos em uma fixture isolada. Não equivale a uma sessão Auth real contra o Supabase remoto. A validação de carga/concorrência, instalação PWA em dispositivos físicos e o primeiro login remoto devem ocorrer no ambiente de destino.

O build ainda sinaliza o bundle principal existente acima de 500 kB e comentários de anotação de dependências. São avisos, não falhas; a nova área usa chunk separado.

## Ativação no ambiente existente

1. Aplique **somente a nova migration**, depois das nove existentes, no Supabase correto. Faça isso antes de publicar este código. Mantenha `fio_private` fora dos schemas expostos pela Data API; o config local já expõe somente `public`.
2. Em Authentication → Users, copie o User UID da sua conta existente. Execute `supabase/register-existing-platform-admin.sql`, substituindo o UUID e o nome. A FK exige um usuário Auth real; o comando não cria conta e não adiciona vínculo a barbearia.
3. Publique o código no projeto Vercel existente, preservando as variáveis atuais. Esta etapa não exige novas chaves ou um provedor de pagamento.
4. Abra `https://SEU-DOMINIO/acesso/plataforma` e entre com suas credenciais existentes. O destino é `/platform`.

Para retirar o acesso global posteriormente, um operador autorizado pode definir `platform_admins.active=false`. A verificação ocorre no servidor e no banco a cada nova requisição/operação.

## Limites intencionais desta etapa

Não foram implementados Push, IA avançada ou cobrança automática. Criar barbearia pelo admin não foi exposto: o onboarding existente cria o OWNER a partir de `auth.uid()` e não deve transformar o administrador global em dono de uma barbearia. As barbearias continuam sendo criadas pelo fluxo existente do responsável.

Alterar o preço do catálogo não altera recibos, não simula pagamentos e não renova períodos automaticamente. Trials/inadimplência são estados administrativos preparados para integração futura; o gating de IA preexistente continua exigindo assinatura ativa. Limites/features foram preservados a partir de `plan_features`, sem ampliar a IA nesta etapa.

# Pendências do FIO SaaS

## Prompt 3 — Platform AI, alertas, Web Push e WebView

- [x] Copiloto exclusivo de PLATFORM_ADMIN com endpoint server-side e API compatível com OpenAI.
- [x] Onze tools allowlisted, schemas estritos, paginação, limites, timeout e retorno sanitizado.
- [x] Receita SaaS explicitamente indisponível quando não há fonte de pagamentos confirmados.
- [x] Proteção contra prompt injection, SQL/tabela arbitrária, vazamento cross-tenant e segredos.
- [x] Propostas de suspender, reativar, alterar plano e resolver alerta com token, expiração, snapshot e confirmação separada.
- [x] Auditoria de perguntas, tools, erros, rate limit, propostas e execução.
- [x] Alertas determinísticos com deduplicação e fila de Web Push opt-in para PLATFORM_ADMIN.
- [x] VAPID server-only, limpeza de subscriptions expiradas e preferências por severidade.
- [x] Banner de navegador interno para Instagram/Facebook, dismissal temporário, fallback contextual e URL preservada.
- [x] IA, alertas, Web Push e portal validados em 320/360/390/430/1440 px sem overflow.
- [x] Typecheck, build portátil e **134 testes** aprovados.

## Etapa 2 — onboarding OWNER

- [x] Onboarding mobile-first em cinco passos com progresso persistido e retomada.
- [x] Identidade, slug público, WhatsApp, Instagram, endereço e comodidades.
- [x] Serviços em centavos, duração, dias e horário padrão.
- [x] Paletas claro/escuro, cor personalizada, preview e assets com Storage tenant-scoped.
- [x] Revisão, ativação, link público, compartilhamento e QR do portal.
- [x] Portal público consumindo identidade, paleta, background, contatos e WhatsApp.
- [x] RLS para progresso, comodidades, paletas e Storage; OWNER/BARBER/CLIENT cobertos por testes.
- [x] Typecheck, build portátil e 65 testes aprovados; contrato de layout cobre 320/360/390/430 px.

## Ativação no ambiente real

- [ ] Aplicar `supabase/migrations/20260915091345_platform_copilot.sql` após todas as migrations anteriores.
- [ ] Aplicar `supabase/migrations/20260915013637_onboarding_experience.sql` depois das migrations anteriores.
- [ ] Confirmar bucket `branding-assets` e políticas no projeto Supabase de destino.
- [ ] Validar login, upload, PostgREST e ativação com contas reais; os testes locais usam PGlite.
- [ ] Configurar domínio/manifest e validar instalação PWA em dispositivos físicos.
- [ ] Configurar `AI_API_URL`, `AI_API_KEY` e `AI_MODEL` no servidor de produção.
- [ ] Configurar `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`; executar `npm run push:dispatch` em worker seguro.

## Limitações conhecidas

- [ ] O schema legado de `business_hours` ainda armazena apenas abertura/fechamento; o intervalo de almoço é exibido e preparado no onboarding, mas ainda não é persistido.
- [ ] Convites de profissionais continuam no fluxo de equipe existente; o onboarding inicial cria apenas o responsável.
- [ ] O QR usa QuickChart em runtime; substituir por geração local se o ambiente exigir zero dependências externas.
- [ ] IA já possui contratos e superfícies para OWNER, BARBER e CLIENT; conectar provedor real e observabilidade depende das credenciais externas.
- [ ] O dispatcher de Web Push precisa de um processo/cron de produção para executar a fila; nenhuma chave VAPID foi criada neste workspace.

## Etapa PLATFORM_ADMIN preservada

- [x] Painel global, autorização server-side, RLS, auditoria e catálogo SaaS permanecem intactos.
- [ ] Aplicar `20260915004746_platform_admin.sql` e registrar o administrador no ambiente de destino.

Relatórios: `docs/ONBOARDING-ETAPA-2.md` e `docs/PLATFORM-AI-ETAPA-3.md`.

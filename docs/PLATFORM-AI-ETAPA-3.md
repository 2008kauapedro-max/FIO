# FIO SaaS — Prompt 3

## Resultado

O Platform Admin agora tem um copiloto operacional restrito, alertas determinísticos, Web Push opt-in e orientação para navegadores internos do Instagram/Facebook. A implementação é aditiva e preserva as migrations anteriores, onboarding, RLS, PWA e as áreas OWNER/BARBER/CLIENT.

## Platform AI

`POST /api/platform/ai` autentica a sessão, valida `PLATFORM_ADMIN`, aplica quota de 200 solicitações/dia e 10 por minuto, limita a mensagem a 2.000 caracteres, usa timeout de 25 segundos e aceita somente a API HTTPS configurada por `AI_API_URL`, `AI_API_KEY` e `AI_MODEL`. A chave fica exclusivamente no servidor.

As tools são declaradas em `server/platform-ai.ts`: resumo, alertas, barbearias, resumo/saúde de barbearia, assinaturas, receita confirmada, atividade recente, atividade de usuário e uso da IA, além da ferramenta de proposta. Cada uma tem schema fechado, paginação máxima de 25, colunas fixas e resposta máxima de 20 KB. Não há SQL, tabela, coluna ou função arbitrária.

Nomes, descrições, auditoria e qualquer conteúdo vindo do banco entram no contexto como `UNTRUSTED DATA`. O prompt do sistema orienta o modelo a ignorar instruções nesses textos; autorização, schemas e confirmação server-side limitam as ações independentemente dessa orientação. A ferramenta de receita retorna `confirmedRevenueCents: null` porque assinaturas administrativas não são pagamentos confirmados.

## Ações e auditoria

`platform_ai_propose` permite somente suspender, reativar, alterar plano ativo ou resolver alerta. A proposta grava ator, alvo, parâmetros, snapshot, token aleatório, validade de dez minutos e estado. O modelo não recebe o token de confirmação. `platform_ai_decide` revalida ator, token, expiração, allowlist, snapshot e estado atual, bloqueia replay e exige o botão separado da interface.

Eventos `platform.ai.*` registram pergunta (somente hash), tool success/error, erro, rate limit, proposta, cancelamento, confirmação, recusa e execução. Nenhum header, token, senha, chave ou prompt bruto é salvo.

## Alertas e Web Push

`platform_alerts` deduplica condições de barbearia suspensa, assinatura `past_due`, falhas repetidas do copiloto e outros eventos determinísticos. O painel filtra por severity/status e sempre resolve por nova proposta.

`push_subscriptions` é exclusivo do próprio PLATFORM_ADMIN, limitado a cinco dispositivos, com opt-in explícito na Configurações. O servidor usa `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`; a chave privada nunca é retornada. `platform_claim_push` e `platform_finish_push` são service-role-only, têm lease, três tentativas e removem endpoints 404/410. O worker é `npm run push:dispatch`.

## Instagram/Facebook WebView

`shared/in-app-browser.ts` centraliza detecção de Instagram/Facebook, expiração de dismissal, instruções por sistema e preservação de URL. `/b/:slug` exibe banner compacto, acessível e dispensável; não força redirecionamento. Dentro do WebView o nudge de instalação PWA é ocultado. Em navegador normal, o fluxo PWA existente continua disponível.

## Validação

- `npm run typecheck`: passou.
- `npm run build`: o sandbox Windows bloqueou o esbuild nativo com `spawn EPERM`.
- `npm test`: o mesmo bloqueio ocorre ao carregar a configuração do Vitest.
- `npm run build:portable`: passou.
- `npm run test:portable`: passou — 7 arquivos, **134 testes**.
- Verificação visual no navegador integrado: Platform AI, alertas, configurações e `/b/:slug` sem overflow em 320, 360, 390, 430 e 1440 px; confirmação, dismissal e fallback verificados.

## Pendências de produção

Aplicar `supabase/migrations/20260915091345_platform_copilot.sql` no Supabase real, configurar as variáveis sem registrar valores no repositório, provisionar o worker/cron do Web Push, validar o provedor AI real e testar permissões PWA em aparelhos físicos. O QR externo e o intervalo de almoço do onboarding permanecem conforme documentado anteriormente.

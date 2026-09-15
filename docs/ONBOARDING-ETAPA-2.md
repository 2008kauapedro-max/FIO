# FIO SaaS — Etapa 2

## Entrega

A Etapa 2 adiciona o onboarding do responsável pela barbearia, mantendo o trabalho da Etapa 1. O fluxo é retomável e segue cinco passos: identidade, serviços, equipe/horário, identidade visual e revisão/ativação.

O OWNER pode configurar nome, slug, WhatsApp, Instagram, endereço, comodidades, serviços com preço em centavos, dias de atendimento, tema, paleta, cor personalizada e imagens de marca. A ativação só ocorre quando há WhatsApp, serviço ativo e horário cadastrado.

## Arquitetura

- Migration: `supabase/migrations/20260915013637_onboarding_experience.sql`.
- `onboarding_progress` guarda passo, etapas concluídas e rascunho por barbearia.
- `shop_amenities` e `shop_palettes` suportam configuração e temas consistentes.
- Funções security-definer validam OWNER, slug, paleta, cor e ativação.
- Assets usam o bucket público `branding-assets`, com caminho `<shop>/<user>/<asset>`, limite de 5 MB e MIME allowlist.
- O portal público recebe paleta, tema, imagens e contatos; números exibidos pelo portal usam o helper `shared/phone.ts` para links `wa.me`.

## Segurança

As policies restringem progresso e gravação de comodidades ao OWNER da mesma barbearia. BARBER e CLIENT não podem escrever onboarding. Paletas são somente leitura pública. Upload, update e delete exigem usuário autenticado, caminho tenant-scoped e membership OWNER. A rota de onboarding exige sessão e tenant ativo antes de chamar as funções.

## Validação

- `npm run typecheck`: passou.
- `npm run build`: bloqueado pelo `spawn EPERM` do esbuild nativo deste Windows sandbox.
- `npm test`: mesmo bloqueio de `spawn EPERM` ao carregar a configuração.
- `npm run build:portable`: passou.
- `npm run test:portable`: passou — 4 arquivos, 65 testes.

O build portátil gerou o bundle de produção normalmente. Os avisos restantes são o aviso de chunk principal acima de 500 kB e comentários PURE do Zod removidos pelo Rollup.

## Pendências externas

Aplicar a migration no Supabase real, validar Auth/Storage/PostgREST e testar PWA em aparelhos físicos. O intervalo de almoço depende de ampliar o schema legado de horários. O QR atual depende de QuickChart em runtime.

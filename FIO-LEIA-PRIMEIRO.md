# FIO — pacote consolidado para testes

Base: `finalfio1(4).zip`. Revisão: 21/09/2026. O ZIP tem o código completo na raiz, preservando as melhorias recebidas. Extraia **na pasta que contém seu package.json** e substitua os arquivos. Não crie uma segunda pasta finalfio1 dentro da atual.

Não inclui `.env`, `.env.local`, `.git`, `.vercel`, node_modules, cache, resultados de testes ou builds. Suas configurações locais continuam na pasta original. Este documento substitui as instruções dos pacotes anteriores.

## O que foi conferido de verdade

- Histórico relevante recuperado por busca; não houve acesso integral garantido a todas as conversas.
- GitHub: `2008kauapedro-max/FIO`, main `d76bb35ebeacc71e186d198288b5b0982281803f`.
- Vercel: projeto `fio`, última publicação de produção consultada READY nesse commit.
- Supabase FIO: `wpnkouothzwjfcqajcpr`, migrations instaladas até `20260919130000_product_polish`.
- As correções locais do ZIP ainda não estavam nesse commit publicado.
- O banco tem buckets de branding, avatar e feed, uma assinatura de provedor e um evento registrado. Isso **não comprova um pagamento real completo**.
- Nenhuma migration, publicação, cobrança ou alteração de conta foi feita na produção durante esta revisão.

## Correções desta revisão

1. Rate limit antes da autenticação, mantendo limites por usuário e por operação. Cabeçalhos arbitrários não definem o IP fora da Vercel. `Retry-After` mantém o tempo correto.
2. JSON inválido retorna 400; corpo excessivo retorna 413; erros não expõem payloads, tokens ou stack traces. Respostas privadas/erros não são cacheados.
3. Integração Turnstile em login, cadastro e recuperação, incluindo o login administrativo. Tokens são renovados após tentativas e invalidados ao expirar. Ativação exige as chaves e o painel descritos abaixo.
4. Cabeçalhos de segurança também para os arquivos estáticos servidos pela Vercel, com os domínios necessários ao CAPTCHA e Supabase.
5. Correção do regex da migration de Storage ainda pendente: arquivos WebP válidos estavam sendo rejeitados. Políticas antigas de UPDATE foram removidas: o aplicativo usa novos nomes e `upsert:false`, evitando contornar INSERT por renomeação.
6. Telefone com `+55` e números locais válidos; atualização de nome/telefone chega também ao cadastro do cliente; barbearia suspensa não altera perfil via RPC.
7. Horários salvos em uma transação: uma falha deixa o expediente anterior intacto.
8. Quota de feedback também no banco, bloqueando bypass por REST direto.
9. Limites anunciados aplicados no banco: FREE 100 clientes, 1 barbeiro e 8 serviços ativos; PRO 1.500 clientes, 5 barbeiros, 40 serviços ativos e 3 ofertas ativas; PREMIUM 15 ofertas ativas, sem esses pequenos limites nas outras categorias. O responsável não entra no limite de barbeiros. Downgrade preserva registros existentes e bloqueia capacidade adicional.
10. Login genérico usa o mesmo espaço de sessão do acesso de gestão, evitando perder a sessão ao recarregar a rota de OWNER. Sessões de cliente/equipe/plataforma continuam separadas por entrada.
11. Vitest atualizado para 4.1.11, versão corrigida para o alerta detectado; Supabase JS fixado à versão resolvida no lockfile. Removida a opção npm `minimum-release-age`, que não funcionava como proteção.
12. Empacotador exclui também `.vercel`; diagnóstico local de ambiente e segredos; smoke test somente de leitura.

Foram preservados: correções de trial → PRO, recuperação de Pix pendente, conciliação SyncPay, proteção contra duplicidade, eventos fora de ordem, roles/RLS, minisite, alterações de design e mobile recebidas.

## Resultado dos testes

- `npm run typecheck`: passou.
- `npm test`: **178/178 testes passaram**, com Vitest 4.1.11.
- `npm run build`: passou para frontend e backend.
- `git diff --check`: passou.
- `npm audit`: **0 vulnerabilidades reportadas** na consulta desta revisão. Isso não é garantia de ausência de vulnerabilidades desconhecidas.
- PostgreSQL embarcado (PGlite): migrations executadas, incluindo Storage com tabelas/funções de teste. Verificados caminhos válidos, cross-tenant, roles, feed privado, limites, telefone, rollback de horários, feedback e cobrança. Não substitui o serviço Storage real.
- Build e arquivos rastreados não contêm os valores privados atuais encontrados nos arquivos de ambiente. Esses valores também não foram encontrados nos objetos textuais examinados do histórico Git. A busca não prova ausência de outras credenciais antigas/desconhecidas.
- Interface: os testes de navegador foram preparados, mas **não executados com sucesso aqui**. O download de Chromium falhou e o navegador remoto não alcançou localhost.
- Avisos restantes do build: bundle principal acima de 500 kB e comentários do Zod descartados pelo Rollup; não impediram o build.

## 1. Testar os arquivos no PowerShell

Abra o terminal na pasta atual do projeto depois de extrair. Se seu caminho ainda for o usado anteriormente:

```powershell
cd C:\Users\Kwai\Downloads\finalfio1
node --version
npm ci
if ($LASTEXITCODE -ne 0) { throw "Falhou a instalação. Pare aqui." }
npm run verify
if ($LASTEXITCODE -ne 0) { throw "Falhou a validação. Não publique." }
npm run check:release
if ($LASTEXITCODE -ne 0) { throw "Foi detectado um problema de segurança/configuração." }
```

Use Node >=22.12. `npm run verify` roda typecheck → testes → build e para na primeira falha. O diagnóstico mostra nomes de variáveis, nunca os valores. PENDENTE significa integração ausente neste ambiente; FALHA impede continuar. SyncPay ausente localmente não prova que esteja ausente na Vercel.

Para testar cobranças localmente, configure suas credenciais no ambiente local com segurança. **O .env deste ZIP recebido não tinha SyncPay.** Não cole segredos no chat ou em comandos que ficam no histórico. Não sobrescreva `.env` com o exemplo se já tiver configurações.

## 2. Aplicar as migrations antes de testar as novas funções

```powershell
npx supabase login
if ($LASTEXITCODE -ne 0) { throw "Login Supabase falhou." }
npx supabase link --project-ref wpnkouothzwjfcqajcpr
if ($LASTEXITCODE -ne 0) { throw "Vínculo Supabase falhou." }
npx supabase migration list
npx supabase db push --dry-run
if ($LASTEXITCODE -ne 0) { throw "Revise a lista de migrations." }
```

Na verificação desta entrega, as pendentes esperadas são exatamente:

- `20260920081758_release_readiness_guards.sql`
- `20260921013409_release_security_fixes.sql`
- `20260921090000_security_hardening.sql`

Se a lista estiver correta:

```powershell
npx supabase db push
if ($LASTEXITCODE -ne 0) { throw "Falhou a migration. Não publique." }
npx supabase migration list
```

Não use `db reset`, `migration repair`, `--include-all` ou reaplicação de migrations antigas para mascarar divergências. Se as versões mudaram desde esta entrega, compare a lista antes. A correção de Storage foi feita na migration que ainda não estava aplicada ao projeto consultado. Se você aplicou a versão antiga dela em outro ambiente, ele precisa de uma migration corretiva adicional; não marque SQL antigo como executado sem aplicar a correção.

## 3. Abrir o aplicativo

```powershell
npm run dev
```

Abra o endereço mostrado pelo Vite, normalmente `http://localhost:5173`. Mantenha esse terminal aberto. Em outro terminal na mesma pasta:

```powershell
node scripts/smoke.mjs http://127.0.0.1:3001
```

Esperado: health 200; memberships e platform/me sem login 401. Esse comando não cria dados nem cobra dinheiro.

A API local usa `.env`; o frontend Vite lê também `.env.local`. Para validar o build de produção local, pare o `dev` e execute `npm start`, usando `http://127.0.0.1:3001`.

## 4. Testes de tela no Windows

Com o Edge instalado:

```powershell
$env:FIO_BROWSER_CHANNEL = "msedge"
npm run test:billing-ui
Remove-Item Env:FIO_BROWSER_CHANNEL -ErrorAction SilentlyContinue
```

Sem Edge, instale o Chromium usado pelo Playwright:

```powershell
npx playwright install chromium
npm run test:billing-ui
```

São cenários sintéticos isolados de cobrança, em desktop e mobile, sem cobrança real: contratar durante trial, reabrir Pix após recarregar, Pix vencido, erro legível, destaque de período e overflow. Os testes antigos de workspace dependiam de `/demo`, removido do produto. `npm run test:ui` agora aponta para a mesma suíte de cobrança válida. A aceitação manual abaixo cobre os demais fluxos.

## 5. O que depende de você nos painéis

### Turnstile e Auth

1. Crie um widget Turnstile na Cloudflare com o domínio real do FIO e localhost se for testar localmente.
2. Coloque **somente a Site Key pública** em `VITE_TURNSTILE_SITE_KEY` na Vercel e no ambiente local. O frontend precisa de novo build após isso.
3. No Supabase, Authentication → Bot and Abuse Protection, selecione Turnstile, salve a **Secret Key** e habilite CAPTCHA. Faça isso em conjunto com o deploy que contém o widget; habilitar apenas o painel pode bloquear o login da versão antiga.
4. Site URL deve ser o domínio real. Autorize somente os retornos controlados usados em `/login`, `/confirm-email` e `/reset-password`, incluindo os parâmetros de `audience`/`shop` e localhost para testes. Não autorize qualquer domínio.
5. Confirme SMTP de autenticação para enviar cadastro/recuperação a clientes reais. Google exige provider no Supabase e cliente OAuth no Google Cloud; callback do provedor: `https://wpnkouothzwjfcqajcpr.supabase.co/auth/v1/callback`.

O ZIP atual tem telefone como **dado de contato**, não um fluxo completo de autenticação/verificação por SMS. Não anuncie OTP por telefone como funcional. Login por e-mail atende ao fluxo principal.

### Firewall

A API tem limites em memória por instância. Configure a barreira compartilhada na Vercel Firewall para abuso de `/api/*`, especialmente rotas públicas. Não aplique desafio interativo ao webhook da SyncPay. Login chama o Supabase diretamente: o WAF da Vercel sozinho não protege Auth; o CAPTCHA e os limites do Supabase são necessários.

### Segredos

O arquivo recebido continha valores para `SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY` e um `VERCEL_OIDC_TOKEN` local. **Troque as chaves privadas reutilizáveis expostas antes de clientes reais**, atualizando os ambientes que as usam. O token OIDC é temporário; não o copie para a configuração permanente. Não há motivo para tratar a chave pública anon/publishable como segredo. Preserve os nomes e configuração dos seis webhooks SyncPay; não recrie integrações sem necessidade. Nenhum valor privado entrou nesta entrega.

### Cobrança e operação comercial

Valide uma cobrança real autorizada por você: plano/ciclo e valor correto → Pix → pagamento → webhook autenticado → assinatura ativa → recursos liberados → recarga/login preservam acesso. Confira o recebimento no provedor; um HTTP 200 de teste não comprova cobrança.

Cancelamento/troca de plano no provedor ainda não tem fluxo de autosserviço validado. Até existir, precisa de atendimento manual real pelo responsável. Não altere apenas a linha no banco, deixando a recorrência externa ativa. Cartão recorrente e Pix Automático não foram confirmados como contratados/disponíveis nesta conta.

Feedback está gravado na tabela `support_feedback`; não há envio transacional por e-mail configurado nem caixa completa de atendimento no painel. O responsável pode consultar as mensagens pelo Supabase Table Editor. Defina quem verifica e responde, e o canal oficial.

Termos/Privacidade ainda exigem sua identificação comercial, contato, cancelamento/reembolso e retenção/exclusão. Não inventei razão social, CNPJ, prazos ou compromissos em seu nome. Isso é pendência para vender, não impede a rodada técnica de teste.

## 6. Aceitação manual antes de clientes reais

Use contas separadas, perfis/janelas isoladas e duas barbearias de teste.

| Teste | Resultado esperado |
|---|---|
| OWNER novo | Cria barbearia; nome, telefone, serviços, horários, logo e publicação funcionam |
| Upload | JPG/PNG vira WebP; avatar/logo/feed válidos funcionam; conta de outra loja não grava |
| CLIENT pelo minisite | Entra na loja correta; agenda só para si; vê seus dados e assinatura |
| BARBER | Vê sua agenda, não finanças/planos administrativos de OWNER |
| Outra barbearia | Sem acesso a clientes, agenda, conversa, feed ou arquivos privados da primeira |
| FREE | IA/feed/comunicação/ofertas pagos bloqueados; limites de quantidade respeitados |
| Trial PRO | Só OWNER ativa uma vez; contratar PRO durante trial funciona |
| Pix pendente | Fechar/recarregar preserva a cobrança; sem geração duplicada; vencido não é oferecido |
| Pagamento confirmado | Provedor confirma e plano libera; reabrir não volta para FREE indevidamente |
| Expiração/suspensão | Recursos pagos bloqueiam; histórico e créditos existentes preservados conforme regras |
| Agenda | Conflito de horário bloqueado; cancelamento respeita janela; conclusão não desconta duas vezes |
| Financeiro | Registro de recebimento sem duplicidade; valores conferidos com dados de teste |
| Perfil/sessão | Nome e telefone sincronizados; login persiste no espaço correto após F5; sair funciona |
| Auth | E-mail de confirmação, recuperação e Google configurado funcionam; CAPTCHA não trava o admin |
| Mobile/PWA | Sem corte horizontal; modal/teclado não cobre ações; abrir link direto e atualizar funcionam |
| Suporte | Mensagem aparece na tabela; sexta mensagem em dez minutos é negada |

Os relatórios/bootstrap usam recortes limitados de dados; não trate a listagem inicial de até 500 registros como exportação integral para contas grandes. Os cards foram ajustados para não prometer indicações ou análises avançadas não implementadas.

## 7. Git e publicação

Sua pasta original já tem `origin` e `main`. Depois dos testes:

```powershell
git status --short
git remote -v
git branch --show-current
git diff --check
if ($LASTEXITCODE -ne 0) { throw "Corrija o diff antes de publicar." }
npm run check:release
if ($LASTEXITCODE -ne 0) { throw "Revise a segurança antes de publicar." }
git add .
git diff --cached --stat
git diff --cached --name-only
```

Confira que `.env`, `.env.local`, `.vercel`, ZIPs e caches não estão no commit. Então:

```powershell
git commit -m "fix: consolidate FIO release security and validation"
if ($LASTEXITCODE -ne 0) { throw "Commit falhou ou não há alterações." }
git push origin main
if ($LASTEXITCODE -ne 0) { throw "Push falhou. Não force o envio." }
```

O projeto consultado está ligado ao GitHub: o push dispara a Vercel. Aguarde READY e confira o SHA novo, não o antigo `d76bb35`. Depois rode:

```powershell
node scripts/smoke.mjs https://usefio.vercel.app
```

Se você escolheu extrair em uma pasta nova **sem .git**, prefira clonar o repositório e aplicar o pacote dentro do clone:

```powershell
git clone https://github.com/2008kauapedro-max/FIO.git FIO-release
cd FIO-release
```

Extraia o ZIP nessa pasta, copie apenas suas configurações locais necessárias com segurança e repita instalação/verificação. Não faça `git init` sobre o projeto existente e não force push.

Deploy direto pela CLI, somente se precisar publicar sem esperar a integração Git:

```powershell
npx vercel login
npx vercel link --project fio --scope pedrokauaps2815-1742s-projects
npx vercel --prod
```

Não execute um segundo deploy se o push já publicou corretamente. Nunca passe segredos em flags de terminal. Para testar a mudança de CAPTCHA antes de produção, configure uma URL de preview controlada nos provedores.

## Erros comuns

| Erro | Ação |
|---|---|
| `npm ci` falha por lockfile | Confirme que package.json e package-lock.json vieram deste mesmo pacote; não use `npm audit fix --force` |
| Rollup/esbuild ausente | Node compatível, `npm ci` na máquina atual; não reutilize node_modules de outro sistema |
| CAPTCHA falha | Mesma chave/widget/provedor, domínio autorizado e build com `VITE_TURNSTILE_SITE_KEY`; não publique só metade da configuração |
| 401 | Entre novamente no acesso correto; confira URL e chave pública Supabase |
| 403 | Confira role, loja, status da loja e plano; não desative RLS |
| 409 `PLAN_CAPACITY` | Limite do plano atingido; desative um item ou mude plano |
| 429 | Aguarde `Retry-After`; não fique repetindo ou rotacionando identidade |
| 503 / RPC inexistente | Confira migrations e variáveis do servidor; não exponha mensagens privadas em prints |
| Upload negado | Aplique as três migrations; arquivo deve usar caminho WebP gerado pelo aplicativo |
| Pix não disponível | Confira variáveis na Vercel, conta SyncPay e cobrança existente; não gere cobranças repetidas com resultado incerto |
| Google indisponível | Configure provider, cliente OAuth e callback/redirects; botão pronto não configura o provedor |
| Histórico de migrations diverge | Pare; envie apenas nomes/versões e erro sem credenciais; não use repair/reset às cegas |
| Push rejeitado | Faça fetch, compare mudanças remotas e resolva conflito; nunca `push --force` |
| Site ainda antigo | Confira SHA da publicação e faça atualização no navegador/PWA |

## Referências verificadas

- CAPTCHA: https://supabase.com/docs/guides/auth/auth-captcha
- Cabeçalhos de IP Vercel: https://vercel.com/docs/headers/request-headers
- Turnstile: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- Correção Vitest: https://github.com/advisories/GHSA-82fw-gwwq-j7x9
- Avisos de funções SECURITY DEFINER: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

O advisor do Supabase encontrou funções SECURITY DEFINER executáveis por autenticados. Muitas são RPCs intencionais e verificam usuário/role; não revogue todas indiscriminadamente. Os testes cobrem operações sensíveis e isolamento, mas não constituem auditoria independente de segurança.

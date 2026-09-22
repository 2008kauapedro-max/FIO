# FIO — Google, CAPTCHA e pagamento

Base: Auth.tsx lido do GitHub main em 22/09/2026. Este pacote substitui somente src/pages/Auth.tsx e adiciona scripts/check-syncpay.mjs. Não contém credenciais nem migrations.

## Aplicar

Extraia na raiz C:\Users\Kwai\Downloads\finalfio1, aceitando substituir src/pages/Auth.tsx.

```powershell
cd C:\Users\Kwai\Downloads\finalfio1
npm run verify
if ($LASTEXITCODE -ne 0) { throw "Validação falhou." }
git diff --check
if ($LASTEXITCODE -ne 0) { throw "Revise o diff." }
git add src/pages/Auth.tsx scripts/check-syncpay.mjs FIO-ATIVAR-INTEGRACOES.md
git commit -m "fix: Google login layout and payment setup diagnostics"
if ($LASTEXITCODE -ne 0) { throw "Commit falhou." }
git push origin main
if ($LASTEXITCODE -ne 0) { throw "Push falhou." }
```

## Google real

O botão chama Supabase signInWithOAuth com provider google e prompt select_account. A seleção das contas acontece no domínio do Google. Não há uma lista de contas simulada dentro do FIO. O botão fica depois de Entrar, separado por “ou”, com o G colorido em SVG. O callback sem audience passa a usar owner explicitamente.

1. No Google Cloud, abra Google Auth Platform. Configure Branding com nome FIO e seus contatos reais; Audience externo. Em Testing, adicione os e-mails de teste; para clientes fora dessa lista, será necessário publicar o app e atender às exigências do Google.
2. Crie um cliente OAuth do tipo Web application.
3. Origem JavaScript: https://usefio.vercel.app
4. URI de redirecionamento autorizada: https://wpnkouothzwjfcqajcpr.supabase.co/auth/v1/callback
5. Supabase do FIO > Authentication > Sign In / Providers > Google: habilite e preencha Client ID e Client Secret do Google. Salve. O segredo fica no Supabase, nunca em variável VITE_.
6. Authentication > URL Configuration: Site URL https://usefio.vercel.app. Preserve redirects existentes; acrescente https://usefio.vercel.app/login e https://usefio.vercel.app/login?** para os parâmetros audience/shop gerados pelo app. Não libere domínios externos arbitrários.
7. Teste entrar como OWNER e CLIENT, escolher a conta, voltar ao FIO, atualizar a página e sair.

Aparência/nome exibido pelo Google dependem de Branding/verificação/domínio. Sem domínio próprio de Auth, o Google pode mostrar o domínio do projeto Supabase.

Erros: provider not enabled = habilitar Google no Supabase; redirect_uri_mismatch = corrigir a URI exata no cliente Google; access_denied em Testing = conferir usuários de teste/Audience. Não envie tokens da URL de retorno em prints.

## CAPTCHA real — Cloudflare Turnstile

O componente já está na versão ddcba26 para login, cadastro, recuperação e login administrativo. Ele só aparece quando VITE_TURNSTILE_SITE_KEY está preenchida no build.

1. No Cloudflare > Turnstile, adicione o widget FIO com hostname usefio.vercel.app e modo Managed. Inclua localhost somente se for testar localmente.
2. Copie a Site Key pública para Vercel > projeto fio > Settings > Environment Variables: VITE_TURNSTILE_SITE_KEY, ambiente Production. Se testar previews, configure também o ambiente/host correspondente.
3. Faça Redeploy do código atual e espere READY. Confirme que o widget aparece no login antes de ativar a exigência do servidor.
4. Supabase > Authentication > Attack Protection: habilite CAPTCHA, selecione Turnstile e insira a Secret Key do mesmo widget. Salve. A Secret Key NÃO vai para o frontend.
5. Teste login, criação de conta, recuperação de senha e acesso administrativo. Turnstile Managed pode validar automaticamente ou pedir interação; não exige sempre uma caixa “não sou um robô”.

Se o widget não aparece: confira Production e faça novo deploy. Invalid sitekey/domain: confira chave pública e hostname. CAPTCHA verification failed: confira o par de chaves e se o desafio expirou.

## Pagamento FIO via SyncPay

A versão atual usa Pix com QR Code/copia e cola e nova cobrança por ciclo (billing_method qr_code). Não é cartão nem débito Pix Automático. A API de recorrência precisa estar disponível para sua conta SyncPay.

Na Vercel > fio > Settings > Environment Variables, confira Production:

```text
SYNCPAY_CLIENT_ID
SYNCPAY_CLIENT_SECRET
SYNCPAY_WEBHOOK_SECRET
```

Use valores reais do painel SyncPay, sem prefixo VITE_. Se já existem segredos por evento, preserve SYNCPAY_WEBHOOK_SECRET_ACTIVATED, OVERDUE, SUSPENDED, CANCELLED, REACTIVATED e RENEWED. Não substitua todos por um segredo inventado. O código também aceita SYNCPAY_WEBHOOK_SECRETS (lista) e SECRET_PREVIOUS para rotação.

Configure o destino dos webhooks de assinatura para:

```text
https://usefio.vercel.app/api/webhooks/syncpay
```

Os segredos configurados no FIO precisam corresponder aos usados pela SyncPay. Preserve os eventos de ativação, atraso, suspensão, cancelamento, reativação e renovação. Depois de alterar variáveis da Vercel, faça Redeploy.

Para verificar credenciais localmente, preencha SYNCPAY_CLIENT_ID e SYNCPAY_CLIENT_SECRET no .env (não envie esse arquivo) e rode:

```powershell
node scripts/check-syncpay.mjs
```

O script autentica e consulta planos; não cria assinaturas/cobranças nem mostra tokens. Sucesso não comprova webhook ou pagamento real. As variáveis locais são independentes das variáveis da Vercel.

Teste real: OWNER > Planos FIO > selecionar plano/ciclo > informar CPF/CNPJ real do comprador > revisar valor e termos > gerar Pix > pagar somente depois de conferir recebedor e valor > atualizar cobrança > verificar plano ativo e recursos liberados. Depois confirme webhook e estado no banco. Apenas receber HTTP 200 no webhook de teste não prova esse ciclo.

Se houver cobrança existente, consulte-a antes de criar outra. Estado incerto: não repita a cobrança; confira no provedor. Atraso/cancelamento/renovação precisam de testes próprios. Não efetue cancelamento apenas alterando o banco; trate também a assinatura no provedor.

## Validação desta entrega

TypeScript e build passaram após o ajuste do Auth.tsx. O diagnóstico SyncPay passou na verificação de sintaxe e identificou credenciais locais ausentes. Não houve pagamento real, ativação de Google/CAPTCHA nos painéis ou publicação deste patch: a integração GitHub retornou 403 ao gravar e o painel Supabase exigiu login. É necessário aplicar este pacote e concluir as configurações acima.

Documentação consultada:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/auth-captcha
- https://blog.syncpayments.com.br/ajuda/assinaturas-via-api-cobranca-recorrente/

# FIO v2 — configuração externa restante

O código fica utilizável em demonstração sem segredos. Para produção, configure somente serviços externos:

1. Supabase: crie um projeto, aplique as migrations `001` a `007` em ordem e preencha `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente do servidor. Nunca exponha service role em variável `VITE_*`.
2. IA: preencha `AI_API_URL`, `AI_API_KEY` e `AI_MODEL`. O endpoint já valida sessão, tenant, papel, plano e quota antes de chamar o provedor.
3. Auth: configure URLs permitidas, confirmação de e-mail, recuperação de senha e SMTP no Supabase.
4. Deploy: configure as mesmas variáveis no host HTTPS e refaça o build quando alterar variáveis `VITE_*`.
5. Pagamentos SaaS e canais externos de mensagens não recebem chaves genéricas porque o provedor ainda não foi escolhido. A estrutura interna não deve inventar contratos de API antes dessa escolha.

Antes de dados reais, rode `npm ci`, `npm run typecheck`, `npm run build`, `npm test` e os testes com Supabase hospedado/staging.

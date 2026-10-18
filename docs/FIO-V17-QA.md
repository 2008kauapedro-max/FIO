# FIO V17 — QA interna antes de homologar pagamentos

Commit de base: `7a053851c22d9ecaaff8f5b78c683d9d83cdce81` (V16).

## O que foi validado numa copia isolada

- Verificacao TypeScript, 483 testes automatizados e build concluídos.
- Playwright executou 16 cenarios (desktop e mobile): contratos de pagamento desabilitado, plano anual sem cobranca, erro sanitizado, tema/responsividade e agenda com agendamento de demonstracao.
- A tela de periodo mensal permanece bloqueada se nao houver meio de pagamento homologado.
- A compra anual so mostra revisao; pagamento segue desabilitado ate confirmacao externa.

## Limites da validacao

- Os testes Playwright rodam em *fixtures* locais que nao usam contas, cobranças, banco ou provider reais.
- Ainda e necessario executar QA real em dispositivos: cadastro, confirmacao de e-mail, login Google/senha, recuperacao de acesso, onboarding, agenda e permissões OWNER/BARBER/CLIENT.
- SyncPay: aguardar contrato tecnico das rotas/parcelas, cotacoes oficiais, homologacao de uma compra e conciliacao. Nao ativar flags de pagamento sem evidencia.
- Stripe nao esta configurada no ambiente principal.
- Revalidar RLS e funcoes SECURITY DEFINER com aviso do Supabase antes de abrir a todos.

## Verificacao recomendada

```powershell
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:billing-ui
```

Nao usar aprovacao da suite de fixtures como prova de pagamento real. Nenhum valor e cobrado por esta V17.

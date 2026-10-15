# FIO anual - integracao preparada (sem cobranca)

## Confirmado
- Precos derivados do catalogo FIO com 20% exatos de desconto.
- Compra unica de 365 dias, sem renovacao automatica.
- Suporte informou `POST /api/v1/orders`, `external_id`, `checkout_url` e `return_url`.

## Nao confirmado tecnicamente
- URL absoluta e autenticacao do endpoint citado (o manual publico usa `/api/partner/v1`).
- Corpo exato para valores, numero de parcelas e repasse de taxas.
- Host de `checkout_url` e assinatura/retorno dos webhooks de pedidos.
- Consulta autenticada do pedido e identificadores de transacao.

## Nesta etapa
- `shared/fio-annual-orders.ts`: pedido unico, preco seguro e validacao de evidencias/URL.
- `tests/fio-annual-orders.test.ts`: testes contra planos errados, URL indevida,
  pedidos sem identificador proprio e pagamento nao confirmado.
- `supabase/migrations/20261015_fio_annual_orders.sql`: tabela NOVA para pedidos avulsos.

## Proxima etapa antes de cobrar
1. Validar payload real em ambiente controlado sem expor credenciais.
2. Criar rota autenticada OWNER, com idempotencia no banco e checagem de assinatura ativa.
3. Criar checkout unico e permitir apenas host HTTPS validado.
4. Validar webhook com assinatura, consultar status na SyncPay e conciliar
   **transacionalmente** uma unica vez (mesmo webhook repetido).
5. Definir como o FIO representa acesso anual sem cobranca recorrente, e testar expiração/reembolso.
6. Ligar o fluxo visual e testar tudo antes de habilitar venda real.

Esta entrega NAO cria cobrancas, NAO aplica SQL automaticamente e NAO altera o checkout mensal.

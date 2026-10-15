# FIO ANUAL V5 - conciliação e ativação transacional (NAO ATIVAR)

Esta entrega prepara, mas NAO executa, a funcao `fio_settle_annual_order_v1`.

## Fluxo exigido antes de vender

1. SyncPay: checkout unico hospedado com external_id, valor, parcelamento e repasse de taxas validados no contrato oficial.
2. Receber webhook autenticado (nao confiar no body sozinho).
3. Consultar o pedido na SyncPay em uma chamada autenticada, usando o identificador do pedido.
4. Normalizar resposta verificada (ID, external_id, moeda, valor liquido de referencia, data de aprovacao, transacao).
5. Preparar os parametros via `annualSettlementCommand` SOMENTE no backend.
6. Invocar a funcao RPC usando apenas chave service_role.
7. A funcao confere, trava o pedido, impede reativacao, atualiza `saas_subscriptions` e o pedido na MESMA transacao.
8. Implementar reembolso/chargeback que revogue os dias nao utilizados e trate excecoes antes de ativar venda real.

## Limitacoes atuais

- O contrato do POST /api/v1/orders do suporte NAO foi verificado na documentacao publica.
- A API publica documentada usa /api/partner/v1 e API de cartao direto, nao checkout hospedado por pedido.
- Nenhuma integracao de criacao de checkout, token de cartao, webhook anual ou consulta do provedor foi executada.
- O SQL NAO foi executado contra Supabase de teste nem producao.
- A V5 NAO faz pagamento real, NAO cria pedido, NAO concede acesso e NAO mexe no mensal.
- A RPC depende da migracao `20261015_fio_annual_orders.sql` (ainda nao aplicada).
- Regras de cancelamento, chargeback e reembolso ainda precisam de implementacao e teste.

**Nao execute as migracoes nem habilite `FIO_ENABLE_ANNUAL_ORDER_DRAFTS`.**

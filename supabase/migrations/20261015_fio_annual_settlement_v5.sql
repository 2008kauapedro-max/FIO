-- FIO annual: atomic, non-recurring, one-time settlement (PREPARATION ONLY).
-- DO NOT APPLY yet. Needs initial fio_annual_orders migration, verified provider
-- adapter, refund/reversal path, and integration tests against a test DB.
-- The RPC must ONLY be invoked server-side after an AUTHENTICATED SyncPay lookup.
-- A boolean/status supplied by a browser or webhook alone is NOT payment proof.

create or replace function public.fio_settle_annual_order_v1(
 p_order_id uuid,
 p_external_id text,
 p_provider_order_id text,
 p_provider_transaction_id text,
 p_merchant_net_cents integer,
 p_paid_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
 v_order public.fio_annual_orders%rowtype;
 v_current public.saas_subscriptions%rowtype;
 v_shop_id uuid;
 v_ends_at timestamptz;
begin
 if p_order_id is null or p_external_id is null or
    nullif(btrim(p_provider_order_id),'') is null or
    nullif(btrim(p_provider_transaction_id),'') is null or
    p_merchant_net_cents is null or p_merchant_net_cents<=0 or p_paid_at is null then
  raise exception 'ANNUAL_INVALID_PROOF';
 end if;
 if length(p_provider_order_id)>200 or length(p_provider_transaction_id)>200 then
  raise exception 'ANNUAL_INVALID_PROOF';
 end if;

 -- Lock the exact order. Repeated webhook processing cannot award another year.
 select * into v_order from public.fio_annual_orders
  where id=p_order_id for update;
 if not found then raise exception 'ANNUAL_ORDER_NOT_FOUND'; end if;

 if v_order.external_id is distinct from p_external_id or
    v_order.provider_order_id is distinct from p_provider_order_id or
    v_order.currency <> 'BRL' or v_order.billing_cycle <> 'annual' or
    v_order.base_amount_cents <> p_merchant_net_cents then
  raise exception 'ANNUAL_PAYMENT_MISMATCH';
 end if;
 if p_paid_at < v_order.created_at - interval '5 minutes' or
    p_paid_at > now() + interval '5 minutes' then
  raise exception 'ANNUAL_INVALID_PAYMENT_DATE';
 end if;

 -- Genuine retries are read-only: even after expiry there is no extension.
 if v_order.state='paid' then
  if v_order.provider_transaction_id is distinct from p_provider_transaction_id then
   raise exception 'ANNUAL_TRANSACTION_MISMATCH';
  end if;
  return jsonb_build_object('orderId',v_order.id,'alreadySettled',true,
   'accessEndsAt',v_order.access_ends_at);
 end if;
 if v_order.state not in ('checkout_ready','review') then
  raise exception 'ANNUAL_ORDER_NOT_READY';
 end if;

 -- Serialize simultaneous annual settlement attempts for the same shop.
 select id into v_shop_id from public.barbershops
  where id=v_order.barbershop_id for update;
 if not found then raise exception 'ANNUAL_SHOP_NOT_FOUND'; end if;

 -- Never overwrite a currently active paid subscription (including a
 -- concurrently created recurring subscription).
 select * into v_current from public.saas_subscriptions
  where barbershop_id=v_shop_id for update;
 if found and v_current.plan<>'FREE' and
    v_current.status in ('active','trialing') and
    (v_current.expires_at is null or v_current.expires_at>now()) then
  raise exception 'ANNUAL_ACTIVE_SUBSCRIPTION_CONFLICT';
 end if;
 if exists (
  select 1 from public.saas_provider_subscriptions
   where barbershop_id=v_shop_id and is_current=true and
   provider_status in ('active','pending_first_payment','overdue','suspended')
 ) then raise exception 'ANNUAL_RECURRING_CONTRACT_CONFLICT'; end if;
 if exists (
  select 1 from public.fio_hosted_checkout_intents
   where barbershop_id=v_shop_id and state in ('creating','ready')
 ) then raise exception 'ANNUAL_HOSTED_CHECKOUT_CONFLICT'; end if;

 -- Exact 365*24 hours, not 12 monthly recurring subscriptions.
 v_ends_at:=p_paid_at + interval '365 days';

 -- All writes below occur inside the same PostgreSQL transaction.
 insert into public.saas_subscriptions
  (barbershop_id,plan,status,starts_at,expires_at,trial_ends_at,cancelled_at)
 values (v_shop_id,v_order.plan_code,'active',p_paid_at,v_ends_at,null,null)
 on conflict (barbershop_id) do update set
  plan=excluded.plan,status='active',starts_at=excluded.starts_at,
  expires_at=excluded.expires_at,trial_ends_at=null,cancelled_at=null;

 update public.fio_annual_orders set
  state='paid',provider_transaction_id=p_provider_transaction_id,
  paid_at=p_paid_at,verified_at=now(),
  access_starts_at=p_paid_at,access_ends_at=v_ends_at,updated_at=now()
 where id=v_order.id and state in ('checkout_ready','review');
 if not found then raise exception 'ANNUAL_SETTLEMENT_RACE'; end if;

 return jsonb_build_object('orderId',v_order.id,'alreadySettled',false,
  'accessEndsAt',v_ends_at);
end;
$function$;

-- Function is accessible ONLY with service_role credentials, never the web app.
revoke all on function public.fio_settle_annual_order_v1(
 uuid,text,text,text,integer,timestamptz) from public;
revoke all on function public.fio_settle_annual_order_v1(
 uuid,text,text,text,integer,timestamptz) from anon,authenticated;
grant execute on function public.fio_settle_annual_order_v1(
 uuid,text,text,text,integer,timestamptz) to service_role;

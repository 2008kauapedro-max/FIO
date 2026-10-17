-- FIO V10: infraestrutura para compra anual AVULSA no cartao.
-- NAO executa cobrancas; codigo de checkout ainda depende de implementacao/testes.
-- Execute somente apos autorizacao explicita e verificacao de migracoes.
BEGIN;

CREATE TABLE IF NOT EXISTS public.fio_annual_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  external_id text NOT NULL UNIQUE,
  plan_code text NOT NULL CHECK (plan_code IN ('SOLO','SOLO_PREMIUM','PRO','PREMIUM')),
  billing_cycle text NOT NULL DEFAULT 'annual' CHECK (billing_cycle='annual'),
  base_amount_cents integer NOT NULL CHECK(base_amount_cents>0),
  currency text NOT NULL DEFAULT 'BRL' CHECK(currency='BRL'),
  installments_max integer NOT NULL DEFAULT 12 CHECK(installments_max BETWEEN 1 AND 12),
  installments_selected integer CHECK(installments_selected BETWEEN 1 AND 12),
  installment_fees_payer text NOT NULL DEFAULT 'customer' CHECK(installment_fees_payer='customer'),
  state text NOT NULL DEFAULT 'preparing',
  provider_order_id text UNIQUE,
  provider_transaction_id text UNIQUE,
  checkout_url text,
  verified_at timestamptz,
  paid_at timestamptz,
  access_starts_at timestamptz,
  access_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- The older preparation migration may already exist in local test DB.
ALTER TABLE public.fio_annual_orders ADD COLUMN IF NOT EXISTS installments_selected integer;
DO $do$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.fio_annual_orders'::regclass AND conname='fio_annual_orders_state_check') THEN
  ALTER TABLE public.fio_annual_orders DROP CONSTRAINT fio_annual_orders_state_check;
 END IF;
END $do$;
ALTER TABLE public.fio_annual_orders ADD CONSTRAINT fio_annual_orders_state_check
 CHECK (state IN ('preparing','submitting','checkout_ready','review','paid','failed','cancelled','refunded'));
CREATE UNIQUE INDEX IF NOT EXISTS fio_annual_orders_one_unsettled_per_shop_v10
 ON public.fio_annual_orders(barbershop_id)
 WHERE state IN ('preparing','submitting','checkout_ready','review');
CREATE INDEX IF NOT EXISTS fio_annual_orders_shop_time ON public.fio_annual_orders(barbershop_id,created_at DESC);
ALTER TABLE public.fio_annual_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.fio_annual_orders FROM PUBLIC,anon,authenticated;
GRANT ALL ON TABLE public.fio_annual_orders TO service_role;

-- Called server-side BEFORE the external POST. Repeated requests cannot resubmit.
CREATE OR REPLACE FUNCTION public.fio_begin_annual_submission_v1(
 p_shop uuid,p_order uuid,p_actor uuid,p_installments integer
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v public.fio_annual_orders%rowtype;
BEGIN
 IF p_installments IS NULL OR p_installments NOT BETWEEN 1 AND 12 THEN RETURN false; END IF;
 SELECT * INTO v FROM public.fio_annual_orders
 WHERE id=p_order AND barbershop_id=p_shop AND actor_user_id=p_actor FOR UPDATE;
 IF NOT FOUND OR v.state<>'preparing' OR v.provider_transaction_id IS NOT NULL THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.saas_provider_subscriptions p
  WHERE p.barbershop_id=p_shop AND p.is_current=true
  AND p.provider_status IN ('active','pending_first_payment','overdue','suspended')) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.saas_subscriptions s
  WHERE s.barbershop_id=p_shop AND s.plan<>'FREE' AND s.status IN ('active','trialing')
  AND (s.expires_at IS NULL OR s.expires_at>now())) THEN RETURN false; END IF;
 UPDATE public.fio_annual_orders SET state='submitting',installments_selected=p_installments,updated_at=now()
 WHERE id=p_order;
 RETURN true;
END $fn$;

-- Only bind a transaction returned by an authenticated SyncPay submission.
-- Unknown network result: remains 'submitting' and must NOT be resubmitted.
CREATE OR REPLACE FUNCTION public.fio_bind_annual_transaction_v1(
 p_shop uuid,p_order uuid,p_transaction text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v public.fio_annual_orders%rowtype;
BEGIN
 IF nullif(btrim(p_transaction),'') IS NULL OR length(p_transaction)>200 THEN RETURN false; END IF;
 SELECT * INTO v FROM public.fio_annual_orders WHERE id=p_order AND barbershop_id=p_shop FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF v.state='review' AND v.provider_transaction_id=p_transaction THEN RETURN true; END IF;
 IF v.state<>'submitting' OR v.provider_transaction_id IS NOT NULL THEN RETURN false; END IF;
 UPDATE public.fio_annual_orders SET state='review',provider_order_id=p_transaction,
  provider_transaction_id=p_transaction,updated_at=now() WHERE id=p_order;
 RETURN true;
END $fn$;

-- The service_role caller MUST first perform an authenticated GET of the exact
-- transaction at SyncPay and verify completed, credit_card, BRL and merchant
-- base amount (excluding any separately charged customer installment interest).
-- The customer gross total + interest MUST be verified separately in the server adapter.
CREATE OR REPLACE FUNCTION public.fio_settle_annual_order_v10(
 p_order_id uuid,p_external_id text,p_transaction_id text,
 p_merchant_base_cents integer,p_paid_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v public.fio_annual_orders%rowtype; s public.saas_subscriptions%rowtype; v_end timestamptz;
BEGIN
 IF p_order_id IS NULL OR nullif(btrim(p_transaction_id),'') IS NULL
  OR length(p_transaction_id)>200 OR p_merchant_base_cents IS NULL
  OR p_merchant_base_cents<=0 OR p_paid_at IS NULL THEN RAISE EXCEPTION 'ANNUAL_INVALID_PROOF'; END IF;
 SELECT * INTO v FROM public.fio_annual_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ANNUAL_ORDER_NOT_FOUND'; END IF;
 IF v.external_id IS DISTINCT FROM p_external_id OR v.provider_transaction_id IS DISTINCT FROM p_transaction_id
  OR v.provider_order_id IS DISTINCT FROM p_transaction_id OR v.base_amount_cents<>p_merchant_base_cents
  OR v.currency<>'BRL' OR v.billing_cycle<>'annual' THEN RAISE EXCEPTION 'ANNUAL_PAYMENT_MISMATCH'; END IF;
 IF p_paid_at<v.created_at-interval '5 minutes' OR p_paid_at>now()+interval '5 minutes' THEN
  RAISE EXCEPTION 'ANNUAL_INVALID_PAYMENT_DATE'; END IF;
 IF v.state='paid' THEN RETURN jsonb_build_object('orderId',v.id,'alreadySettled',true,'accessEndsAt',v.access_ends_at); END IF;
 IF v.state<>'review' THEN RAISE EXCEPTION 'ANNUAL_ORDER_NOT_READY'; END IF;
 PERFORM 1 FROM public.barbershops WHERE id=v.barbershop_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ANNUAL_SHOP_NOT_FOUND'; END IF;
 SELECT * INTO s FROM public.saas_subscriptions WHERE barbershop_id=v.barbershop_id FOR UPDATE;
 IF FOUND AND s.plan<>'FREE' AND s.status IN ('active','trialing')
  AND (s.expires_at IS NULL OR s.expires_at>now()) THEN RAISE EXCEPTION 'ANNUAL_ACTIVE_SUBSCRIPTION_CONFLICT'; END IF;
 IF EXISTS(SELECT 1 FROM public.saas_provider_subscriptions WHERE barbershop_id=v.barbershop_id
  AND is_current=true AND provider_status IN ('active','pending_first_payment','overdue','suspended')) THEN
  RAISE EXCEPTION 'ANNUAL_RECURRING_CONTRACT_CONFLICT'; END IF;
 IF EXISTS(SELECT 1 FROM public.fio_hosted_checkout_intents WHERE barbershop_id=v.barbershop_id
  AND state IN ('creating','ready')) THEN RAISE EXCEPTION 'ANNUAL_HOSTED_CHECKOUT_CONFLICT'; END IF;
 v_end=p_paid_at+interval '365 days';
 INSERT INTO public.saas_subscriptions
  (barbershop_id,plan,status,starts_at,expires_at,trial_ends_at,cancelled_at)
 VALUES(v.barbershop_id,v.plan_code,'active',p_paid_at,v_end,NULL,NULL)
 ON CONFLICT(barbershop_id) DO UPDATE SET plan=excluded.plan,status='active',
  starts_at=excluded.starts_at,expires_at=excluded.expires_at,trial_ends_at=NULL,cancelled_at=NULL;
 UPDATE public.fio_annual_orders SET state='paid',verified_at=now(),paid_at=p_paid_at,
  access_starts_at=p_paid_at,access_ends_at=v_end,updated_at=now() WHERE id=v.id AND state='review';
 IF NOT FOUND THEN RAISE EXCEPTION 'ANNUAL_SETTLEMENT_RACE'; END IF;
 RETURN jsonb_build_object('orderId',v.id,'alreadySettled',false,'accessEndsAt',v_end);
END $fn$;

REVOKE ALL ON FUNCTION public.fio_begin_annual_submission_v1(uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fio_begin_annual_submission_v1(uuid,uuid,uuid,integer) TO service_role;
REVOKE ALL ON FUNCTION public.fio_bind_annual_transaction_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fio_bind_annual_transaction_v1(uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.fio_settle_annual_order_v10(uuid,text,text,integer,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fio_settle_annual_order_v10(uuid,text,text,integer,timestamptz) TO service_role;
COMMIT;

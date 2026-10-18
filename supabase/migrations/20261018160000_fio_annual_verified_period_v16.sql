-- V16: corrigir evidencia anual apos trigger de reativacao; nenhuma cobranca ou novo pedido.
BEGIN;
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
  (barbershop_id,plan,status,starts_at,expires_at,trial_ends_at,cancelled_at,verified_paid_until,retained_paid_until)
 VALUES(v.barbershop_id,v.plan_code,'active',p_paid_at,v_end,NULL,NULL,v_end,NULL)
 ON CONFLICT(barbershop_id) DO UPDATE SET plan=excluded.plan,status='active',
  starts_at=excluded.starts_at,expires_at=excluded.expires_at,trial_ends_at=NULL,cancelled_at=NULL,
  verified_paid_until=excluded.verified_paid_until,retained_paid_until=NULL;
 -- O gatilho BEFORE UPDATE OF status pode limpar verified_paid_until em uma troca de FREE para pago.
 -- Gravar novamente em UPDATE sem a coluna status impede a perda dessa prova.
 UPDATE public.saas_subscriptions SET verified_paid_until=v_end,updated_at=now()
 WHERE barbershop_id=v.barbershop_id AND status='active' AND plan=v.plan_code
   AND starts_at=p_paid_at AND expires_at=v_end;
 IF NOT FOUND THEN RAISE EXCEPTION 'ANNUAL_VERIFIED_PERIOD_NOT_RECORDED'; END IF;
 UPDATE public.fio_annual_orders SET state='paid',verified_at=now(),paid_at=p_paid_at,
  access_starts_at=p_paid_at,access_ends_at=v_end,updated_at=now() WHERE id=v.id AND state='review';
 IF NOT FOUND THEN RAISE EXCEPTION 'ANNUAL_SETTLEMENT_RACE'; END IF;
 RETURN jsonb_build_object('orderId',v.id,'alreadySettled',false,'accessEndsAt',v_end);
END $fn$;

REVOKE ALL ON FUNCTION public.fio_settle_annual_order_v10(uuid,text,text,integer,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fio_settle_annual_order_v10(uuid,text,text,integer,timestamptz) TO service_role;
COMMIT;
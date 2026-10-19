-- V22: 14-day trial without card, payment mandate or automatic renewal.
BEGIN;
CREATE OR REPLACE FUNCTION public.start_fio_no_card_trial(p_shop uuid,p_confirmed boolean)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE s public.saas_subscriptions%rowtype; shop_mode text; trial_end timestamptz;
BEGIN
 IF p_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'CONFIRMATION_REQUIRED'; END IF;
 IF auth.uid() IS NULL OR public.member_role(p_shop) IS DISTINCT FROM 'OWNER' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM public.barbershops WHERE id=p_shop FOR UPDATE;
 SELECT operation_mode INTO shop_mode FROM public.barbershops WHERE id=p_shop;
 IF shop_mode NOT IN ('SOLO','SHOP') OR shop_mode IS NULL THEN RAISE EXCEPTION 'TRIAL_NOT_AVAILABLE'; END IF;
 SELECT * INTO s FROM public.saas_subscriptions WHERE barbershop_id=p_shop FOR UPDATE;
 IF NOT FOUND OR s.plan<>'FREE' OR s.status NOT IN ('active','inactive','cancelled')
  OR s.trial_ends_at IS NOT NULL OR s.verified_paid_until IS NOT NULL
  THEN RAISE EXCEPTION 'TRIAL_NOT_AVAILABLE'; END IF;
 IF EXISTS (SELECT 1 FROM public.audit_events WHERE barbershop_id=p_shop AND action IN ('saas_pro_trial_started','fio_no_card_trial_started'))
  THEN RAISE EXCEPTION 'TRIAL_ALREADY_USED'; END IF;
 IF EXISTS (SELECT 1 FROM public.saas_provider_subscriptions WHERE barbershop_id=p_shop
   AND (is_current=true OR provider_status IN ('active','pending_first_payment','overdue','suspended'))) THEN
  RAISE EXCEPTION 'TRIAL_BILLING_CONFLICT'; END IF;
 IF EXISTS (SELECT 1 FROM public.fio_annual_orders WHERE barbershop_id=p_shop AND state NOT IN ('failed','cancelled','refunded')) THEN
  RAISE EXCEPTION 'TRIAL_BILLING_CONFLICT'; END IF;
 IF EXISTS (SELECT 1 FROM public.fio_hosted_checkout_intents WHERE barbershop_id=p_shop AND state IN ('creating','ready')) THEN
  RAISE EXCEPTION 'TRIAL_BILLING_CONFLICT'; END IF;
 trial_end:=now()+interval '14 days';
 UPDATE public.saas_subscriptions SET plan=CASE WHEN shop_mode='SOLO' THEN 'SOLO' ELSE 'PRO' END,
  status='trialing',starts_at=now(),current_period_end=trial_end,expires_at=trial_end,trial_ends_at=trial_end,
  cancelled_at=NULL,verified_paid_until=NULL,retained_paid_until=NULL
 WHERE barbershop_id=p_shop;
 INSERT INTO public.audit_events(barbershop_id,actor_id,action,target_id)
 VALUES(p_shop,auth.uid(),'fio_no_card_trial_started',p_shop);
 RETURN trial_end;
END $fn$;
REVOKE ALL ON FUNCTION public.start_fio_no_card_trial(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_fio_no_card_trial(uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.start_saas_pro_trial(p_shop uuid) RETURNS timestamptz
LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $fn$
 SELECT public.start_fio_no_card_trial(p_shop,true);
$fn$;
COMMIT;

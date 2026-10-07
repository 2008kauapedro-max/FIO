-- FIO: permite uma nova assinatura apos cancelamento completo da anterior.
-- PREPARADO, NAO APLICADO: executar somente apos autorizacao do dono.
begin;
create or replace function public.apply_stripe_subscription_state(
 p_event_id text,
 p_event_type text,
 p_event_created_at timestamptz,
 p_body_sha256 text,
 p_shop uuid,
 p_actor uuid,
 p_subscription_token text,
 p_customer_token text,
 p_price_token text,
 p_plan_code text,
 p_billing_cycle text,
 p_amount_cents integer,
 p_provider_status text,
 p_started_at timestamptz,
 p_access_until timestamptz,
 p_cancelled_at timestamptz,
 p_terms_version text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
 link public.saas_provider_subscriptions;
 current_link public.saas_provider_subscriptions;
 fio_status text;
begin
 -- Serializa novos links de assinatura por barbearia em webhooks concorrentes.
 perform pg_advisory_xact_lock(hashtextextended('stripe_shop:'||p_shop::text,0));
 if p_provider_status not in ('pending_first_payment','active','overdue','suspended','cancelled') then
  raise exception 'STRIPE_STATUS_UNKNOWN';
 end if;

 if p_plan_code not in ('SOLO','SOLO_PREMIUM','PRO','PLUS','PREMIUM') then
  raise exception 'STRIPE_PLAN_UNKNOWN';
 end if;

 if p_billing_cycle not in ('monthly','annual') then
  raise exception 'STRIPE_CYCLE_UNKNOWN';
 end if;

 if p_amount_cents<=0 then
  raise exception 'STRIPE_AMOUNT_INVALID';
 end if;

 if p_provider_status in ('active','overdue') and p_access_until is null then
  raise exception 'STRIPE_PERIOD_REQUIRED';
 end if;

 insert into public.stripe_webhook_events(
  event_id,event_type,subscription_token,occurred_at,body_sha256
 ) values(
  p_event_id,p_event_type,p_subscription_token,p_event_created_at,p_body_sha256
 )
 on conflict(event_id) do nothing;

 if not found then
  return jsonb_build_object('applied',false,'duplicate',true);
 end if;

 select *
 into link
 from public.saas_provider_subscriptions
 where provider='stripe'
   and provider_subscription_token=p_subscription_token
 for update;

 if not found then
  select *
  into current_link
  from public.saas_provider_subscriptions
  where barbershop_id=p_shop
    and is_current
  for update;

  if found then
   if current_link.provider_status='cancelled' then
    -- Arquiva uma assinatura anterior ja cancelada; nova compra pode ser ativada.
    -- Assinaturas ativas/pendentes de qualquer provedor continuam protegidas.
    update public.saas_provider_subscriptions
     set is_current=false,updated_at=now()
     where id=current_link.id and provider_status='cancelled';
   else
    update public.stripe_webhook_events
     set result='conflict',processed_at=now()
     where event_id=p_event_id;

    return jsonb_build_object(
     'applied',false,
     'conflict',true,
     'current_provider',current_link.provider
    );
   end if;
  end if;

  insert into public.saas_provider_subscriptions(
   provider,
   barbershop_id,
   provider_subscription_token,
   provider_plan_token,
   provider_customer_token,
   plan_code,
   billing_cycle,
   amount_cents,
   provider_status,
   is_current,
   terms_accepted_by,
   terms_version,
   started_at,
   last_event_at,
   cancelled_at
  ) values(
   'stripe',
   p_shop,
   p_subscription_token,
   p_price_token,
   p_customer_token,
   p_plan_code,
   p_billing_cycle,
   p_amount_cents,
   p_provider_status,
   true,
   p_actor,
   p_terms_version,
   p_started_at,
   p_event_created_at,
   p_cancelled_at
  )
  returning * into link;
 else
  if link.barbershop_id<>p_shop then
   raise exception 'STRIPE_SUBSCRIPTION_CONFLICT';
  end if;

  update public.saas_provider_subscriptions
   set provider_plan_token=p_price_token,
       provider_customer_token=p_customer_token,
       plan_code=p_plan_code,
       billing_cycle=p_billing_cycle,
       amount_cents=p_amount_cents,
       provider_status=p_provider_status,
       started_at=coalesce(started_at,p_started_at),
       last_event_at=greatest(coalesce(last_event_at,p_event_created_at),p_event_created_at),
       cancelled_at=case
        when p_provider_status='cancelled' then coalesce(p_cancelled_at,p_event_created_at)
        when p_provider_status='active' then null
        else cancelled_at
       end,
       updated_at=now()
   where id=link.id
   returning * into link;
 end if;

 if not link.is_current then
  update public.stripe_webhook_events
   set result='historical',processed_at=now()
   where event_id=p_event_id;

  return jsonb_build_object('applied',false,'historical',true);
 end if;

 if p_provider_status='active' then
  fio_status:='active';
 elsif p_provider_status='overdue' then
  fio_status:='past_due';
 elsif p_provider_status='suspended' then
  fio_status:='inactive';
 elsif p_provider_status='cancelled' then
  fio_status:='cancelled';
 else
  update public.stripe_webhook_events
   set result='applied',processed_at=now()
   where event_id=p_event_id;

  return jsonb_build_object(
   'applied',true,
   'entitlement_changed',false,
   'provider_status',p_provider_status
  );
 end if;

 update public.saas_subscriptions
 set plan=p_plan_code,
     status=fio_status,
     starts_at=case
      when p_provider_status in ('active','overdue')
       then coalesce(starts_at,p_started_at,p_event_created_at)
      else starts_at
     end,
     current_period_end=case
      when p_provider_status in ('active','overdue')
       then p_access_until
      else current_period_end
     end,
     expires_at=case
      when p_provider_status in ('active','overdue')
       then p_access_until
      else least(coalesce(expires_at,p_event_created_at),p_event_created_at)
     end,
     cancelled_at=case
      when p_provider_status='cancelled'
       then coalesce(p_cancelled_at,p_event_created_at)
      when p_provider_status='active'
       then null
      else cancelled_at
     end
 where barbershop_id=p_shop;

 if not found then
  raise exception 'SAAS_SUBSCRIPTION_UNKNOWN';
 end if;

 update public.stripe_webhook_events
  set result='applied',processed_at=now()
  where event_id=p_event_id;

 return jsonb_build_object(
  'applied',true,
  'entitlement_changed',true,
  'status',fio_status,
  'plan',p_plan_code
 );
end
$function$;

commit;

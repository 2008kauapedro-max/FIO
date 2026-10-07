begin;

-- Stripe recurring billing for FIO.
-- Keeps SyncPay legacy rows intact and adds Stripe as a second provider.

alter table public.saas_provider_subscriptions
 drop constraint if exists saas_provider_subscriptions_provider_check;

alter table public.saas_provider_subscriptions
 add constraint saas_provider_subscriptions_provider_check
 check(provider in ('syncpay','stripe'));

alter table public.saas_provider_subscriptions
 add column if not exists provider_customer_token text;

alter table public.saas_provider_subscriptions
 drop constraint if exists saas_provider_subscriptions_provider_customer_token_check;

alter table public.saas_provider_subscriptions
 add constraint saas_provider_subscriptions_provider_customer_token_check
 check(provider_customer_token is null or length(provider_customer_token) between 8 and 200);

create index if not exists saas_provider_customer_token
 on public.saas_provider_subscriptions(provider,provider_customer_token)
 where provider_customer_token is not null;

-- One billable provider may be current for a shop at a time.
create unique index if not exists one_current_saas_provider_subscription
 on public.saas_provider_subscriptions(barbershop_id)
 where is_current;

create table if not exists public.stripe_webhook_events (
 event_id text primary key check(length(event_id) between 8 and 200),
 event_type text not null check(length(event_type) between 3 and 120),
 subscription_token text not null check(length(subscription_token) between 8 and 200),
 occurred_at timestamptz not null,
 body_sha256 text not null check(body_sha256 ~ '^[0-9a-f]{64}$'),
 result text not null default 'received'
  check(result in ('received','applied','duplicate','historical','conflict')),
 processed_at timestamptz not null default now()
);

create index if not exists stripe_webhook_time
 on public.stripe_webhook_events(occurred_at desc);

alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from public,anon,authenticated;
grant all on public.stripe_webhook_events to service_role;

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
   update public.stripe_webhook_events
    set result='conflict',processed_at=now()
    where event_id=p_event_id;

   return jsonb_build_object(
    'applied',false,
    'conflict',true,
    'current_provider',current_link.provider
   );
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

revoke all on function public.apply_stripe_subscription_state(
 text,text,timestamptz,text,uuid,uuid,text,text,text,text,text,integer,text,timestamptz,timestamptz,timestamptz,text
) from public,anon,authenticated;

grant execute on function public.apply_stripe_subscription_state(
 text,text,timestamptz,text,uuid,uuid,text,text,text,text,text,integer,text,timestamptz,timestamptz,timestamptz,text
) to service_role;

commit;

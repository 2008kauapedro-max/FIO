-- V8: acesso pago demonstrado, cancelamento confirmado, prioridade de pacotes sem apagar dados.
-- DEPENDE da migracao local V7; executar somente apos revisao/aprovacao.
begin;
alter table public.saas_subscriptions add column if not exists verified_paid_until timestamptz;

create table if not exists public.fio_client_plan_priority (
 barbershop_id uuid primary key references public.barbershops(id) on delete cascade,
 ordered_plan_ids uuid[] not null default '{}',
 updated_at timestamptz not null default now()
);
alter table public.fio_client_plan_priority enable row level security;
revoke all on public.fio_client_plan_priority from public,anon,authenticated;
grant select,insert,update on public.fio_client_plan_priority to service_role;

-- Only logged-in members of this exact shop can READ priorities; mutations go via owner-only API.
create or replace function public.fio_client_plan_priority_for_shop(p_shop uuid)
returns uuid[] language plpgsql stable security definer set search_path to '' as $fn$
declare ids uuid[];
begin
 if auth.uid() is null or not exists(
  select 1 from public.memberships m
  where m.barbershop_id=p_shop and m.user_id=auth.uid() and m.active
 ) then raise exception 'FORBIDDEN'; end if;
 select ordered_plan_ids into ids from public.fio_client_plan_priority where barbershop_id=p_shop;
 return coalesce(ids,'{}'::uuid[]);
end $fn$;
revoke all on function public.fio_client_plan_priority_for_shop(uuid) from public,anon;
grant execute on function public.fio_client_plan_priority_for_shop(uuid) to authenticated;

-- Period is eligible for grace only if a real provider-reported paid charge was verified
-- in our server and its paid_at matches the current ~30-day payment period.
create or replace function public.fio_mark_verified_paid_period_v1(p_shop uuid,p_token text,p_due timestamptz,p_paid_at timestamptz)
returns boolean language plpgsql security definer set search_path to '' as $fn$
begin
 if p_due is null or p_paid_at is null or p_due<=p_paid_at
  or p_due>p_paid_at+interval '40 days' then return false; end if;
 if not exists(
  select 1 from public.saas_provider_subscriptions p
  join public.syncpay_plan_mappings m on m.provider_plan_token=p.provider_plan_token
  where p.barbershop_id=p_shop and p.provider='syncpay'
  and p.provider_subscription_token=p_token and p.is_current
  and p.provider_status='active' and p.billing_cycle='monthly'
  and m.billing_method in ('pix_automatico','credit_card')
 ) then return false; end if;
 if exists(select 1 from public.syncpay_refund_requests r where r.barbershop_id=p_shop and r.subscription_token=p_token) then return false; end if;
 update public.saas_subscriptions set verified_paid_until=p_due,updated_at=now()
 where barbershop_id=p_shop and status='active' and expires_at=p_due and plan<>'FREE';
 return found;
end $fn$;
revoke all on function public.fio_mark_verified_paid_period_v1(uuid,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.fio_mark_verified_paid_period_v1(uuid,text,timestamptz,timestamptz) to service_role;

-- Finalize ONLY after the provider AND local subscription record both say cancelled.
create or replace function public.fio_finalize_paid_cancellation_v1(p_shop uuid,p_token text)
returns boolean language plpgsql security definer set search_path to '' as $fn$
declare d timestamptz;
begin
 select i.paid_until into d from public.fio_paid_cancellation_intents i
 where i.barbershop_id=p_shop and i.subscription_token=p_token
  and i.state in ('prepared','confirmed') for update;
 if d is null or d<=now() then return false; end if;
 if not exists(
  select 1 from public.saas_provider_subscriptions p
  where p.barbershop_id=p_shop and p.provider='syncpay'
  and p.provider_subscription_token=p_token and p.is_current
  and p.provider_status='cancelled'
 ) then return false; end if;
 if exists(select 1 from public.syncpay_refund_requests r where r.barbershop_id=p_shop and r.subscription_token=p_token)
 then return false; end if;
 update public.fio_paid_cancellation_intents set state='confirmed',updated_at=now()
 where barbershop_id=p_shop and subscription_token=p_token;
 update public.saas_subscriptions set retained_paid_until=d,updated_at=now()
 where barbershop_id=p_shop and plan<>'FREE' and status='cancelled';
 return found;
end $fn$;
revoke all on function public.fio_finalize_paid_cancellation_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.fio_finalize_paid_cancellation_v1(uuid,text) to service_role;

-- Clear old paid-period proof on reactivation or switching billing period.
create or replace function public.fio_reset_retained_on_reactivation_v1()
returns trigger language plpgsql security definer set search_path to '' as $fn$
begin
 if new.status in ('active','trialing') then
  new.retained_paid_until:=null;
  if old.status is distinct from new.status or old.plan is distinct from new.plan
     or old.expires_at is distinct from new.expires_at then
   new.verified_paid_until:=null;
  end if;
 end if;
 return new;
end $fn$;
revoke all on function public.fio_reset_retained_on_reactivation_v1() from public,anon,authenticated;

-- Refund request revokes retained time AND grace proof. Existing trigger points here.
create or replace function public.fio_revoke_retention_on_refund_record_v1()
returns trigger language plpgsql security definer set search_path to '' as $fn$
begin
 update public.fio_paid_cancellation_intents set state='revoked',updated_at=now()
 where barbershop_id=new.barbershop_id and subscription_token=new.subscription_token;
 update public.saas_subscriptions set retained_paid_until=null,verified_paid_until=null,updated_at=now()
 where barbershop_id=new.barbershop_id;
 return new;
end $fn$;
revoke all on function public.fio_revoke_retention_on_refund_record_v1() from public,anon,authenticated;

create or replace function public.effective_fio_plan(p_shop uuid)
returns text language sql stable security definer set search_path to '' as $fn$
 select case
  when s.status in ('active','trialing') and (s.expires_at is null or s.expires_at>now()) then s.plan
  when s.status='past_due' and s.starts_at is not null
   and s.verified_paid_until=s.expires_at
   and s.expires_at<=now() and s.expires_at+interval '2 days'>now() then s.plan
  when s.status='cancelled' and s.retained_paid_until>now()
   and exists(select 1 from public.fio_paid_cancellation_intents i
    join public.saas_provider_subscriptions p
     on p.barbershop_id=i.barbershop_id and p.provider_subscription_token=i.subscription_token
    where i.barbershop_id=s.barbershop_id and i.state='confirmed'
     and i.paid_until=s.retained_paid_until and p.is_current and p.provider='syncpay' and p.provider_status='cancelled')
   then s.plan
  else 'FREE' end
 from public.saas_subscriptions s where s.barbershop_id=p_shop
 union all select 'FREE' where not exists(select 1 from public.saas_subscriptions s where s.barbershop_id=p_shop)
 limit 1
$fn$;
commit;

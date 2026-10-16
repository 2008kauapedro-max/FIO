-- REVIEW BEFORE APPLYING. Production safety: do not apply before running test suite.
begin;
alter table public.saas_subscriptions add column if not exists retained_paid_until timestamptz;
create table if not exists public.fio_paid_cancellation_intents (
 id uuid primary key default gen_random_uuid(),
 barbershop_id uuid not null references public.barbershops(id),
 subscription_token text not null,
 paid_until timestamptz not null,
 state text not null default 'prepared' check (state in ('prepared','confirmed','revoked')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(barbershop_id,subscription_token)
);
alter table public.fio_paid_cancellation_intents enable row level security;
revoke all on public.fio_paid_cancellation_intents from public, anon, authenticated;

-- Server-only prepare captures a proven future paid-through date before provider cancellation.
create or replace function public.fio_prepare_paid_cancellation_v1(p_shop uuid,p_token text)
returns timestamptz language plpgsql security definer set search_path to '' as $fn$
declare d timestamptz; result_date timestamptz;
begin
 if not exists(select 1 from public.saas_provider_subscriptions p where p.barbershop_id=p_shop and p.provider='syncpay' and p.provider_subscription_token=p_token and p.is_current and p.provider_status='active')
 then raise exception 'FIO_CANCEL_NOT_ACTIVE'; end if;
 select s.expires_at into d from public.saas_subscriptions s where s.barbershop_id=p_shop and s.status='active' and s.expires_at>now() for update;
 if d is null then raise exception 'FIO_CANCEL_NO_PAID_PERIOD'; end if;
 if exists(select 1 from public.syncpay_refund_requests r where r.barbershop_id=p_shop and r.subscription_token=p_token)
 then raise exception 'FIO_CANCEL_REFUND_PENDING'; end if;
 insert into public.fio_paid_cancellation_intents(barbershop_id,subscription_token,paid_until)
 values(p_shop,p_token,d)
 on conflict(barbershop_id,subscription_token) do update
 set updated_at=now() where fio_paid_cancellation_intents.state='prepared'
 returning paid_until into result_date;
 if result_date is null then raise exception 'FIO_CANCEL_ALREADY_FINAL'; end if;
 return result_date;
end $fn$;

-- Called only after independent authenticated provider confirmation of cancellation.
create or replace function public.fio_finalize_paid_cancellation_v1(p_shop uuid,p_token text)
returns boolean language plpgsql security definer set search_path to '' as $fn$
declare d timestamptz;
begin
 select i.paid_until into d from public.fio_paid_cancellation_intents i
 where i.barbershop_id=p_shop and i.subscription_token=p_token and i.state in ('prepared','confirmed') for update;
 if d is null then return false; end if;
 if not exists(select 1 from public.saas_provider_subscriptions p where p.barbershop_id=p_shop and p.provider='syncpay' and p.provider_subscription_token=p_token and p.is_current) then return false; end if;
 if exists(select 1 from public.syncpay_refund_requests r where r.barbershop_id=p_shop and r.subscription_token=p_token)
 then return false; end if;
 update public.fio_paid_cancellation_intents set state='confirmed',updated_at=now()
 where barbershop_id=p_shop and subscription_token=p_token;
 update public.saas_subscriptions set retained_paid_until=d,updated_at=now()
 where barbershop_id=p_shop and plan<>'FREE';
 return found;
end $fn$;

create or replace function public.fio_revoke_paid_cancellation_v1(p_shop uuid,p_token text)
returns void language plpgsql security definer set search_path to '' as $fn$
begin
 update public.fio_paid_cancellation_intents set state='revoked',updated_at=now()
 where barbershop_id=p_shop and subscription_token=p_token;
 update public.saas_subscriptions set retained_paid_until=null,updated_at=now() where barbershop_id=p_shop;
end $fn$;

-- Refund request existence revokes retention atomically with its record.
create or replace function public.fio_revoke_retention_on_refund_record_v1()
returns trigger language plpgsql security definer set search_path to '' as $fn$
begin
 update public.fio_paid_cancellation_intents set state='revoked',updated_at=now()
 where barbershop_id=new.barbershop_id and subscription_token=new.subscription_token;
 update public.saas_subscriptions set retained_paid_until=null,updated_at=now()
 where barbershop_id=new.barbershop_id;
 return new;
end $fn$;
drop trigger if exists fio_revoke_retention_on_refund_record_v1 on public.syncpay_refund_requests;
create trigger fio_revoke_retention_on_refund_record_v1
after insert on public.syncpay_refund_requests
for each row execute function public.fio_revoke_retention_on_refund_record_v1();

create or replace function public.fio_reset_retained_on_reactivation_v1()
returns trigger language plpgsql security definer set search_path to '' as $fn$
begin
 if new.status in ('active','trialing') then new.retained_paid_until:=null; end if;
 return new;
end $fn$;
drop trigger if exists fio_reset_retained_on_reactivation_v1 on public.saas_subscriptions;
create trigger fio_reset_retained_on_reactivation_v1 before update of status on public.saas_subscriptions
for each row execute function public.fio_reset_retained_on_reactivation_v1();

revoke all on function public.fio_prepare_paid_cancellation_v1(uuid,text) from public,anon,authenticated;
revoke all on function public.fio_finalize_paid_cancellation_v1(uuid,text) from public,anon,authenticated;
revoke all on function public.fio_revoke_paid_cancellation_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.fio_prepare_paid_cancellation_v1(uuid,text) to service_role;
grant execute on function public.fio_finalize_paid_cancellation_v1(uuid,text) to service_role;
grant execute on function public.fio_revoke_paid_cancellation_v1(uuid,text) to service_role;

-- Bloqueia EXECUTE anonimo nas duas funcoes novas de gatilho.
revoke all on function public.fio_revoke_retention_on_refund_record_v1() from public, anon, authenticated;
revoke all on function public.fio_reset_retained_on_reactivation_v1() from public, anon, authenticated;

create or replace function public.effective_fio_plan(p_shop uuid)
returns text language sql stable security definer set search_path to '' as $fn$
 select case
  when s.status in ('active','trialing') and (s.expires_at is null or s.expires_at>now()) then s.plan
  when s.status='past_due' and s.starts_at is not null and s.expires_at is not null and s.expires_at<=now() and s.expires_at+interval '2 days'>now() then s.plan
  when s.status='cancelled' and s.retained_paid_until>now() then s.plan
  else 'FREE' end
 from public.saas_subscriptions s where s.barbershop_id=p_shop
 union all select 'FREE' where not exists(select 1 from public.saas_subscriptions s where s.barbershop_id=p_shop)
 limit 1
$fn$;
commit;

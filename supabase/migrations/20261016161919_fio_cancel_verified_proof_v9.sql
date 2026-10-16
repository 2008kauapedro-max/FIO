-- FIO V9 - verify paid period before preparing or finalizing cancellation retention.
-- No charges, subscriptions, customers or plan rows are changed by this migration.
-- Requires V7 + V8. A cancellation can still proceed when proof is absent;
-- only the extra paid-through retention is then unavailable.
begin;

create or replace function public.fio_prepare_paid_cancellation_v1(p_shop uuid,p_token text)
returns timestamptz language plpgsql security definer set search_path to '' as $fn$
declare d timestamptz; result_date timestamptz;
begin
 if not exists(
  select 1 from public.saas_provider_subscriptions p
  where p.barbershop_id=p_shop and p.provider='syncpay'
   and p.provider_subscription_token=p_token and p.is_current
   and p.provider_status='active'
 ) then raise exception 'FIO_CANCEL_NOT_ACTIVE'; end if;

 -- Evidence must match THIS billing period; dates or trials alone never suffice.
 select s.expires_at into d
 from public.saas_subscriptions s
 where s.barbershop_id=p_shop and s.status='active' and s.plan<>'FREE'
  and s.expires_at>now() and s.verified_paid_until=s.expires_at
 for update;

 -- Do not block cancelling renewals just because payment evidence is absent.
 if d is null then return null; end if;
 if exists(
  select 1 from public.syncpay_refund_requests r
  where r.barbershop_id=p_shop and r.subscription_token=p_token
 ) then return null; end if;

 insert into public.fio_paid_cancellation_intents(barbershop_id,subscription_token,paid_until)
 values(p_shop,p_token,d)
 on conflict(barbershop_id,subscription_token) do update
  set paid_until=excluded.paid_until,state='prepared',updated_at=now()
  where fio_paid_cancellation_intents.state in ('prepared','confirmed')
 returning paid_until into result_date;
 return result_date;
end $fn$;

create or replace function public.fio_finalize_paid_cancellation_v1(p_shop uuid,p_token text)
returns boolean language plpgsql security definer set search_path to '' as $fn$
declare d timestamptz;
begin
 select i.paid_until into d from public.fio_paid_cancellation_intents i
 where i.barbershop_id=p_shop and i.subscription_token=p_token
  and i.state in ('prepared','confirmed') for update;
 if d is null or d<=now() then return false; end if;

 -- Finalization must see both verified payment evidence and provider cancellation.
 if not exists(
  select 1 from public.saas_subscriptions s
  join public.saas_provider_subscriptions p on p.barbershop_id=s.barbershop_id
  where s.barbershop_id=p_shop and s.plan<>'FREE' and s.status='cancelled'
   and s.verified_paid_until=d
   and p.provider='syncpay' and p.provider_subscription_token=p_token
   and p.is_current and p.provider_status='cancelled'
 ) then return false; end if;
 if exists(
  select 1 from public.syncpay_refund_requests r
  where r.barbershop_id=p_shop and r.subscription_token=p_token
 ) then return false; end if;

 update public.fio_paid_cancellation_intents set state='confirmed',updated_at=now()
 where barbershop_id=p_shop and subscription_token=p_token;
 update public.saas_subscriptions set retained_paid_until=d,updated_at=now()
 where barbershop_id=p_shop and plan<>'FREE' and status='cancelled'
  and verified_paid_until=d;
 return found;
end $fn$;

-- Keep the SQL effective entitlement consistent with the TypeScript policy.
create or replace function public.effective_fio_plan(p_shop uuid)
returns text language sql stable security definer set search_path to '' as $fn$
 select case
  when s.status in ('active','trialing') and (s.expires_at is null or s.expires_at>now()) then s.plan
  when s.status='past_due' and s.starts_at is not null
   and s.verified_paid_until=s.expires_at
   and s.expires_at<=now() and s.expires_at+interval '2 days'>now() then s.plan
  when s.status='cancelled' and s.retained_paid_until>now()
   and s.verified_paid_until=s.retained_paid_until
   and exists(select 1 from public.fio_paid_cancellation_intents i
    join public.saas_provider_subscriptions p
     on p.barbershop_id=i.barbershop_id and p.provider_subscription_token=i.subscription_token
    where i.barbershop_id=s.barbershop_id and i.state='confirmed'
     and i.paid_until=s.retained_paid_until and p.is_current
     and p.provider='syncpay' and p.provider_status='cancelled')
   then s.plan
  else 'FREE' end
 from public.saas_subscriptions s where s.barbershop_id=p_shop
 union all select 'FREE' where not exists(select 1 from public.saas_subscriptions s where s.barbershop_id=p_shop)
 limit 1
$fn$;

revoke all on function public.fio_prepare_paid_cancellation_v1(uuid,text) from public,anon,authenticated;
revoke all on function public.fio_finalize_paid_cancellation_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.fio_prepare_paid_cancellation_v1(uuid,text) to service_role;
grant execute on function public.fio_finalize_paid_cancellation_v1(uuid,text) to service_role;
commit;

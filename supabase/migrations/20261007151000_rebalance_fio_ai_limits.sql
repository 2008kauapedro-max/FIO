-- Rebalance FIO AI usage by commercial plan.
-- PRO/SOLO: 60 requests per user/day.
-- PREMIUM/SOLO_PREMIUM: no daily quota; per-minute guard remains for abuse protection.

update public.plan_features
set ai_daily_limit = case
  when plan in ('SOLO','PRO') then 60
  when plan in ('SOLO_PREMIUM','PREMIUM') then 0
  else ai_daily_limit
 end,
 ai_per_minute = case
  when plan in ('SOLO_PREMIUM','PREMIUM') then 30
  else ai_per_minute
 end
where plan in ('SOLO','PRO','SOLO_PREMIUM','PREMIUM');

create or replace function public.consume_assistant_quota(p_shop uuid) returns void
language plpgsql security definer set search_path='' as $$
declare
 f public.plan_features;
 u public.assistant_usage;
 today date := (now() at time zone 'UTC')::date;
begin
 if public.member_role(p_shop) is null then raise exception 'FORBIDDEN'; end if;

 select pf.* into f
 from public.saas_subscriptions s
 join public.plan_features pf on pf.plan=s.plan
 where s.barbershop_id=p_shop
   and s.status in ('active','trialing','past_due')
   and (s.expires_at is null or s.expires_at>now());

 if f.plan is null or not f.ai_enabled then raise exception 'PLAN_REQUIRED'; end if;

 insert into public.assistant_usage(barbershop_id,user_id,day)
 values(p_shop,auth.uid(),today)
 on conflict do nothing;

 select * into u
 from public.assistant_usage
 where barbershop_id=p_shop
   and user_id=auth.uid()
   and day=today
 for update;

 if f.ai_daily_limit > 0 and u.request_count>=f.ai_daily_limit then
  raise exception 'DAILY_LIMIT';
 end if;

 if u.minute_start>now()-interval '1 minute'
    and u.minute_count>=f.ai_per_minute then
  raise exception 'RATE_LIMIT';
 end if;

 update public.assistant_usage
 set request_count=request_count+1,
     minute_count=case
       when minute_start<=now()-interval '1 minute' then 1
       else minute_count+1
     end,
     minute_start=case
       when minute_start<=now()-interval '1 minute' then now()
       else minute_start
     end
 where barbershop_id=p_shop
   and user_id=auth.uid()
   and day=today;
end $$;

revoke all on function public.consume_assistant_quota(uuid) from public,anon;
grant execute on function public.consume_assistant_quota(uuid) to authenticated;
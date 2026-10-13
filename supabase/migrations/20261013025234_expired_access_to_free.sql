-- FIO: overdue access becomes Free immediately without deleting barbershop records.
-- This migration is already applied to the FIO Supabase environment.
begin;
create or replace function public.effective_fio_plan(p_shop uuid)
 returns text
 language sql
 stable security definer
 set search_path to ''
as $function$
 select case
  when s.status in ('active','trialing')
    and (s.expires_at is null or s.expires_at > now()) then s.plan
  else 'FREE'
 end
 from public.saas_subscriptions s
 where s.barbershop_id=p_shop
 union all
 select 'FREE'
 where not exists (select 1 from public.saas_subscriptions s where s.barbershop_id=p_shop)
 limit 1
$function$;
commit;

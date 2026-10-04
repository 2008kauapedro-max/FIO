begin;

-- FIO SOLO PREMIUM + entrada atômica do cliente — 2026-10-04

alter table public.plan_features
 drop constraint if exists plan_features_plan_check;
alter table public.plan_features
 add constraint plan_features_plan_check
 check(plan in ('FREE','SOLO','SOLO_PREMIUM','PRO','PLUS','PREMIUM'));

insert into public.plan_features(plan,ai_enabled,ai_daily_limit,ai_per_minute)
values('SOLO_PREMIUM',true,500,20)
on conflict(plan) do update set
 ai_enabled=excluded.ai_enabled,
 ai_daily_limit=excluded.ai_daily_limit,
 ai_per_minute=excluded.ai_per_minute;

alter table public.saas_provider_subscriptions
 drop constraint if exists saas_provider_subscriptions_plan_code_check;
alter table public.saas_provider_subscriptions
 add constraint saas_provider_subscriptions_plan_code_check
 check(plan_code in ('SOLO','SOLO_PREMIUM','PRO','PLUS','PREMIUM'));

alter table public.syncpay_plan_mappings
 drop constraint if exists syncpay_plan_mappings_plan_code_check;
alter table public.syncpay_plan_mappings
 add constraint syncpay_plan_mappings_plan_code_check
 check(plan_code in ('SOLO','SOLO_PREMIUM','PRO','PLUS','PREMIUM'));

alter table public.syncpay_plan_changes
 drop constraint if exists syncpay_plan_changes_target_plan_check;
alter table public.syncpay_plan_changes
 add constraint syncpay_plan_changes_target_plan_check
 check(target_plan in ('SOLO','SOLO_PREMIUM','PRO','PLUS','PREMIUM'));

create or replace function fio_private.enforce_plan_capacity()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
 plan text;
 cap integer;
 used integer;
begin
 if tg_table_name='memberships' then
  if new.role<>'BARBER' or not new.active then return new; end if;
 end if;

 if tg_table_name in ('services','subscription_plans') then
  if not new.active then return new; end if;
 end if;

 if tg_op='UPDATE' then
  if old.active and new.active then return new; end if;
 end if;

 perform pg_advisory_xact_lock(
  hashtextextended('capacity:'||new.barbershop_id::text,0)
 );

 plan:=public.effective_fio_plan(new.barbershop_id);

 if tg_table_name='memberships' then
  cap:=case plan
   when 'FREE' then 1
   when 'SOLO' then 0
   when 'SOLO_PREMIUM' then 0
   when 'PRO' then 5
   when 'PLUS' then 10
   when 'PREMIUM' then 10
   else null
  end;

  select count(*) into used
  from public.memberships
  where barbershop_id=new.barbershop_id
    and role='BARBER'
    and active;

 elsif tg_table_name='services' then
  cap:=case plan
   when 'FREE' then 8
   when 'SOLO' then 20
   when 'SOLO_PREMIUM' then null
   when 'PRO' then 20
   when 'PLUS' then 80
   when 'PREMIUM' then 50
   else null
  end;

  select count(*) into used
  from public.services
  where barbershop_id=new.barbershop_id
    and active;

 elsif tg_table_name='customers' then
  cap:=case plan
   when 'FREE' then 85
   when 'SOLO' then 500
   when 'SOLO_PREMIUM' then null
   when 'PRO' then 500
   when 'PLUS' then 3000
   when 'PREMIUM' then 2000
   else null
  end;

  select count(*) into used
  from public.customers
  where barbershop_id=new.barbershop_id;

 elsif tg_table_name='subscription_plans' then
  if public.member_role(new.barbershop_id)
     is distinct from 'OWNER'
     or plan='FREE'
  then
   return new;
  end if;

  cap:=case plan
   when 'SOLO' then 5
   when 'SOLO_PREMIUM' then null
   when 'PRO' then 5
   when 'PLUS' then 8
   when 'PREMIUM' then 15
   else 0
  end;

  select count(*) into used
  from public.subscription_plans
  where barbershop_id=new.barbershop_id
    and active;
 end if;

 if cap is not null and used>=cap then
  raise exception 'PLAN_CAPACITY';
 end if;

 return new;
end
$function$;

-- Junta vínculo + telefone na mesma transação.
-- Se o telefone falhar, membership/customer também são revertidos.
create or replace function public.join_barbershop_with_profile(
 p_slug text,
 p_name text,
 p_phone text
) returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare shop uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

 shop:=public.join_barbershop(p_slug,p_name);
 perform public.update_own_profile(shop,p_name,p_phone);

 return shop;
end
$function$;

revoke all on function public.join_barbershop_with_profile(text,text,text) from public,anon;
grant execute on function public.join_barbershop_with_profile(text,text,text) to authenticated;

commit;

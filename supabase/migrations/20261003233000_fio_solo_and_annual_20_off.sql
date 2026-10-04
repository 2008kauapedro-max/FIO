-- FIO SOLO + anuais 20% — 2026-10-03

-- 1) Novo plano SOLO no catálogo de permissões.
alter table public.plan_features
 drop constraint if exists plan_features_plan_check;
alter table public.plan_features
 add constraint plan_features_plan_check
 check(plan in ('FREE','SOLO','PRO','PLUS','PREMIUM'));

insert into public.plan_features(plan,ai_enabled,ai_daily_limit,ai_per_minute)
values('SOLO',true,150,10)
on conflict(plan) do update set
 ai_enabled=excluded.ai_enabled,
 ai_daily_limit=excluded.ai_daily_limit,
 ai_per_minute=excluded.ai_per_minute;

-- 2) Cobrança aceita SOLO.
alter table public.saas_provider_subscriptions
 drop constraint if exists saas_provider_subscriptions_plan_code_check;
alter table public.saas_provider_subscriptions
 add constraint saas_provider_subscriptions_plan_code_check
 check(plan_code in ('SOLO','PRO','PLUS','PREMIUM'));

alter table public.syncpay_plan_mappings
 drop constraint if exists syncpay_plan_mappings_plan_code_check;
alter table public.syncpay_plan_mappings
 add constraint syncpay_plan_mappings_plan_code_check
 check(plan_code in ('SOLO','PRO','PLUS','PREMIUM'));

alter table public.syncpay_plan_changes
 drop constraint if exists syncpay_plan_changes_target_plan_check;
alter table public.syncpay_plan_changes
 add constraint syncpay_plan_changes_target_plan_check
 check(target_plan in ('SOLO','PRO','PLUS','PREMIUM'));

-- 3) Limites do SOLO.
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

-- 4) O trial usa SOLO quando a conta foi criada como SOLO.
create or replace function public.start_saas_pro_trial(p_shop uuid)
returns timestamptz
language plpgsql
security definer
set search_path=''
as $function$
declare
 sub public.saas_subscriptions;
 trial_end timestamptz;
 target_plan text;
 mode text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if public.member_role(p_shop) is distinct from 'OWNER' then raise exception 'FORBIDDEN'; end if;

 select * into sub
 from public.saas_subscriptions
 where barbershop_id=p_shop
 for update;

 if not found then raise exception 'TRIAL_NOT_AVAILABLE'; end if;
 if sub.trial_ends_at is not null then raise exception 'TRIAL_ALREADY_USED'; end if;
 if sub.plan <> 'FREE' then raise exception 'TRIAL_NOT_AVAILABLE'; end if;

 select operation_mode into mode from public.barbershops where id=p_shop;
 target_plan:=case when mode='SOLO' then 'SOLO' else 'PRO' end;
 trial_end:=now()+interval '14 days';

 update public.saas_subscriptions
 set plan=target_plan,status='trialing',starts_at=now(),expires_at=trial_end,
     current_period_end=trial_end,trial_ends_at=trial_end,cancelled_at=null
 where barbershop_id=p_shop;

 insert into public.audit_events(barbershop_id,actor_id,action,target_id)
 values(p_shop,auth.uid(),case when target_plan='SOLO' then 'saas_solo_trial_started' else 'saas_pro_trial_started' end,p_shop);

 return trial_end;
end
$function$;
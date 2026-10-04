begin;

-- O catálogo de planos administrativos precisa conhecer os planos SOLO.
-- Sem estas linhas, o trigger platform_saas_sync transforma plan_id em NULL
-- quando o trial muda FREE -> SOLO, e o trial falha por NOT NULL.
insert into public.saas_plans(
 code,
 name,
 price_cents,
 active,
 features,
 limits,
 updated_at
)
select
 pf.plan,
 case pf.plan
  when 'SOLO' then 'FIO SOLO'
  when 'SOLO_PREMIUM' then 'FIO SOLO PREMIUM'
 end,
 case pf.plan
  when 'SOLO' then 7990
  when 'SOLO_PREMIUM' then 19790
 end,
 true,
 jsonb_build_object(
  'ai_enabled',pf.ai_enabled
 ),
 case pf.plan
  when 'SOLO' then
   jsonb_build_object(
    'customers',500,
    'barbers',0,
    'services',20,
    'client_plans',5,
    'ai_daily_limit',pf.ai_daily_limit,
    'ai_per_minute',pf.ai_per_minute
   )
  else
   jsonb_build_object(
    'customers',null,
    'barbers',0,
    'services',null,
    'client_plans',null,
    'ai_daily_limit',pf.ai_daily_limit,
    'ai_per_minute',pf.ai_per_minute
   )
 end,
 now()
from public.plan_features pf
where pf.plan in ('SOLO','SOLO_PREMIUM')
on conflict(code) do update
set
 name=excluded.name,
 price_cents=excluded.price_cents,
 active=true,
 features=excluded.features,
 limits=excluded.limits,
 updated_at=now();

-- Defesa em profundidade: BARBER não cria para cliente e OWNER em
-- operação SOLO também não cria. CLIENT continua criando o próprio horário.
create or replace function public.book_appointment(
 p_shop uuid,
 p_client uuid,
 p_barber uuid,
 p_service uuid,
 p_start timestamptz,
 p_use_subscription boolean default false
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
 v_role text;
 v_mode text;
begin
 v_role:=public.member_role(p_shop);

 if v_role='BARBER' then
  raise exception 'FORBIDDEN';
 end if;

 if v_role='OWNER' then
  select operation_mode
  into v_mode
  from public.barbershops
  where id=p_shop;

  if v_mode='SOLO' then
   raise exception 'FORBIDDEN';
  end if;
 end if;

 return fio_private.book_appointment_before_staff_lock(
  p_shop,
  p_client,
  p_barber,
  p_service,
  p_start,
  p_use_subscription
 );
end
$function$;

revoke all
on function public.book_appointment(uuid,uuid,uuid,uuid,timestamptz,boolean)
from public,anon;

grant execute
on function public.book_appointment(uuid,uuid,uuid,uuid,timestamptz,boolean)
to authenticated;

commit;

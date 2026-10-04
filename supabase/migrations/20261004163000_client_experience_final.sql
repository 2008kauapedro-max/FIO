begin;

-- ============================================================
-- FIO 2026-10-04
-- Experiência final do cliente:
-- 1) grade real de 20 minutos para criar/remarcar;
-- 2) calendário distingue fechado (cinza) de lotado (vermelho);
-- 3) perfil do profissional expõe somente estatísticas/reviews
--    anônimos para membros da própria barbearia.
-- ============================================================


-- ------------------------------------------------------------
-- Horário estruturalmente aberto, ignorando SOMENTE agendamentos.
-- Serve para saber se um dia é "fechado" ou apenas "lotado".
-- ------------------------------------------------------------
create or replace function fio_private.slot_open_without_bookings(
 p_shop uuid,
 p_barber uuid,
 p_service uuid,
 p_start timestamptz
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
 select exists(
  select 1

  from public.services s

  join public.barbershops b
   on b.id=s.barbershop_id

  where
   s.id=p_service
   and s.barbershop_id=p_shop
   and s.active

   and fio_private.is_provider(
    p_shop,
    p_barber
   )

   and p_start>now()
   and p_start<=now()+interval '60 days'

   and not exists(
    select 1
    from public.shop_closures c
    where
     c.barbershop_id=p_shop
     and c.day=
      (p_start at time zone b.timezone)::date
   )

   and not exists(
    select 1
    from public.staff_service_rules r
    where
     r.barbershop_id=p_shop
     and r.barber_id=p_barber
     and r.service_id=p_service
     and not r.enabled
   )

   and exists(
    select 1
    from public.business_hours h
    where
     h.barbershop_id=p_shop
     and h.weekday=
      extract(
       dow from p_start at time zone b.timezone
      )
     and
      (p_start at time zone b.timezone)::time
      >=h.opens_at
     and
      (
       (
        p_start+
        make_interval(mins=>s.duration_minutes)
       ) at time zone b.timezone
      )::date
      =
      (p_start at time zone b.timezone)::date
     and
      (
       (
        p_start+
        make_interval(mins=>s.duration_minutes)
       ) at time zone b.timezone
      )::time
      <=h.closes_at
   )

   and (
    not exists(
     select 1
     from public.staff_hours h
     where
      h.barbershop_id=p_shop
      and h.barber_id=p_barber
    )

    or exists(
     select 1
     from public.staff_hours h
     where
      h.barbershop_id=p_shop
      and h.barber_id=p_barber
      and h.weekday=
       extract(
        dow from p_start at time zone b.timezone
       )
      and
       (p_start at time zone b.timezone)::time
       >=h.opens_at
      and
       (
        (
         p_start+
         make_interval(mins=>s.duration_minutes)
        ) at time zone b.timezone
       )::time
       <=h.closes_at
    )
   )

   and not exists(
    select 1
    from public.staff_blocks x
    where
     x.barbershop_id=p_shop
     and x.barber_id=p_barber
     and x.starts_at<
      p_start+
      make_interval(mins=>s.duration_minutes)
     and x.ends_at>p_start
   )
 );
$function$;

revoke all
on function fio_private.slot_open_without_bookings(
 uuid,uuid,uuid,timestamptz
)
from public,anon,authenticated;


-- ------------------------------------------------------------
-- Calendário mensal.
-- closed=true: não há expediente/configuração real.
-- closed=false + available_count=0: lotado.
-- ------------------------------------------------------------
create or replace function public.calendar_day_availability(
 p_shop uuid,
 p_barber uuid,
 p_service uuid,
 p_month date
)
returns table(
 day date,
 available_count bigint,
 closed boolean
)
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
 zone text;
 duration int;
 role_name text;
 first_day date;
 last_day date;
 today_local date;
begin

 role_name:=public.member_role(p_shop);

 if role_name is null then
  raise exception 'FORBIDDEN';
 end if;

 if
  role_name='BARBER'
  and p_barber is distinct from auth.uid()
 then
  raise exception 'FORBIDDEN';
 end if;

 select b.timezone
 into zone
 from public.barbershops b
 where b.id=p_shop;

 select s.duration_minutes
 into duration
 from public.services s
 where
  s.id=p_service
  and s.barbershop_id=p_shop
  and s.active;

 if zone is null then
  raise exception 'INVALID_SHOP';
 end if;

 if duration is null then
  raise exception 'INVALID_SERVICE';
 end if;

 first_day:=
  date_trunc('month',p_month)::date;

 last_day:=
  (
   first_day+
   interval '1 month - 1 day'
  )::date;

 today_local:=
  (now() at time zone zone)::date;

 if
  first_day>
  date_trunc(
   'month',
   today_local+interval '60 days'
  )::date
 then
  raise exception 'INVALID_TIME';
 end if;

 return query

 with calendar_days as (
  select value::date as day
  from generate_series(
   greatest(first_day,today_local),
   least(last_day,today_local+60),
   interval '1 day'
  ) value
 )

 select
  cd.day,

  (
   select count(*)::bigint
   from public.available_slots(
    p_shop,
    p_barber,
    p_service,
    cd.day
   )
  ) as available_count,

  not exists(
   select 1

   from public.business_hours h

   cross join lateral generate_series(
    (cd.day+h.opens_at) at time zone zone,
    (
     (cd.day+h.closes_at) at time zone zone
    )-
    make_interval(mins=>duration),
    interval '20 minutes'
   ) candidate(slot)

   where
    h.barbershop_id=p_shop
    and h.weekday=extract(dow from cd.day)

    and exists(
     select 1

     from public.memberships m

     join public.barbershops b
      on b.id=m.barbershop_id

     where
      m.barbershop_id=p_shop
      and m.active

      and (
       m.role='BARBER'
       or (
        m.role='OWNER'
        and b.operation_mode='SOLO'
       )
      )

      and (
       p_barber is null
       or m.user_id=p_barber
      )

      and fio_private.slot_open_without_bookings(
       p_shop,
       m.user_id,
       p_service,
       candidate.slot
      )
    )
  ) as closed

 from calendar_days cd

 order by cd.day;

end
$function$;

revoke all
on function public.calendar_day_availability(
 uuid,uuid,uuid,date
)
from public,anon;

grant execute
on function public.calendar_day_availability(
 uuid,uuid,uuid,date
)
to authenticated;


-- ------------------------------------------------------------
-- Corrige o bug encontrado em produção:
-- a UI oferece 09:20/09:40 etc., mas a função anterior ainda
-- recusava qualquer minuto diferente de 00.
--
-- Agora a validação usa a MESMA grade de 20 min do available_slots.
-- ------------------------------------------------------------
create or replace function fio_private.book_appointment_before_staff_lock(
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
 chosen uuid;
 r text;
 zone text;
 duration int;
 local_day date;
begin

 r:=public.member_role(p_shop);

 if
  r is null
  or (
   r='CLIENT'
   and not public.owns_customer(
    p_shop,
    p_client
   )
  )
  or (
   r='BARBER'
   and p_barber is distinct from auth.uid()
  )
 then
  raise exception 'FORBIDDEN';
 end if;

 if
  p_start<=now()
  or p_start>now()+interval '60 days'
 then
  raise exception 'INVALID_TIME';
 end if;

 perform pg_advisory_xact_lock(
  hashtextextended(
   'booking:'||p_shop::text,
   0
  )
 );

 select b.timezone
 into zone
 from public.barbershops b
 where b.id=p_shop;

 if zone is null then
  raise exception 'INVALID_SHOP';
 end if;

 select s.duration_minutes
 into duration
 from public.services s
 where
  s.id=p_service
  and s.barbershop_id=p_shop
  and s.active;

 if duration is null then
  raise exception 'INVALID_SERVICE';
 end if;

 local_day:=
  (p_start at time zone zone)::date;

 -- O horário precisa pertencer à grade de 20 minutos
 -- ancorada no horário de abertura do estabelecimento.
 if not exists(
  select 1

  from public.business_hours h

  cross join lateral generate_series(
   (local_day+h.opens_at) at time zone zone,
   (
    (local_day+h.closes_at) at time zone zone
   )-
   make_interval(mins=>duration),
   interval '20 minutes'
  ) candidate(slot)

  where
   h.barbershop_id=p_shop
   and h.weekday=extract(dow from local_day)
   and candidate.slot=p_start
 )
 then
  raise exception 'SLOT_UNAVAILABLE';
 end if;

 select m.user_id
 into chosen

 from public.memberships m

 join public.barbershops b
  on b.id=m.barbershop_id

 where
  m.barbershop_id=p_shop
  and m.active

  and (
   m.role='BARBER'
   or (
    m.role='OWNER'
    and b.operation_mode='SOLO'
   )
  )

  and (
   p_barber is null
   or m.user_id=p_barber
  )

  and fio_private.slot_fits(
   p_shop,
   m.user_id,
   p_service,
   p_start
  )

 order by
  (
   select coalesce(
    sum(
     extract(
      epoch from a.ends_at-a.starts_at
     )
    ),
    0
   )

   from public.appointments a

   where
    a.barbershop_id=p_shop
    and a.barber_id=m.user_id
    and a.status not in (
     'cancelled',
     'no_show'
    )
    and
     (
      a.starts_at at time zone zone
     )::date
     =
     local_day
  ),
  m.user_id

 limit 1;

 if chosen is null then
  raise exception 'SLOT_UNAVAILABLE';
 end if;

 return fio_private.book_appointment_legacy(
  p_shop,
  p_client,
  chosen,
  p_service,
  p_start,
  p_use_subscription
 );

end
$function$;

revoke all
on function fio_private.book_appointment_before_staff_lock(
 uuid,uuid,uuid,uuid,timestamptz,boolean
)
from public,anon,authenticated;


-- ------------------------------------------------------------
-- Remarcação na mesma grade de 20 minutos.
-- ------------------------------------------------------------
create or replace function public.reschedule_appointment(
 p_shop uuid,
 p_id uuid,
 p_start timestamptz
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
 a public.appointments;
 r text;
 duration int;
 zone text;
 local_day date;
begin

 r:=public.member_role(p_shop);

 if r is null then
  raise exception 'FORBIDDEN';
 end if;

 perform pg_advisory_xact_lock(
  hashtextextended(
   'booking:'||p_shop::text,
   0
  )
 );

 select *
 into a
 from public.appointments
 where
  id=p_id
  and barbershop_id=p_shop
 for update;

 if
  a.id is null
  or (
   r='CLIENT'
   and not public.owns_customer(
    p_shop,
    a.client_id
   )
  )
  or (
   r='BARBER'
   and a.barber_id<>auth.uid()
  )
 then
  raise exception 'FORBIDDEN';
 end if;

 if
  a.status not in (
   'scheduled',
   'confirmed'
  )
 then
  raise exception 'INVALID_TRANSITION';
 end if;

 if
  r='CLIENT'
  and a.starts_at<now()+interval '2 hours'
 then
  raise exception 'CANCELLATION_WINDOW';
 end if;

 if
  p_start<=now()
  or p_start>now()+interval '60 days'
 then
  raise exception 'INVALID_TIME';
 end if;

 select b.timezone
 into zone
 from public.barbershops b
 where b.id=p_shop;

 if zone is null then
  raise exception 'INVALID_SHOP';
 end if;

 select s.duration_minutes
 into duration
 from public.services s
 where
  s.id=a.service_id
  and s.barbershop_id=p_shop
  and s.active;

 if duration is null then
  raise exception 'INVALID_SERVICE';
 end if;

 local_day:=
  (p_start at time zone zone)::date;

 if not exists(
  select 1

  from public.business_hours h

  cross join lateral generate_series(
   (local_day+h.opens_at) at time zone zone,
   (
    (local_day+h.closes_at) at time zone zone
   )-
   make_interval(mins=>duration),
   interval '20 minutes'
  ) candidate(slot)

  where
   h.barbershop_id=p_shop
   and h.weekday=extract(dow from local_day)
   and candidate.slot=p_start
 )
 then
  raise exception 'SLOT_UNAVAILABLE';
 end if;

 if not fio_private.slot_fits(
  p_shop,
  a.barber_id,
  a.service_id,
  p_start,
  a.id
 )
 then
  raise exception 'SLOT_UNAVAILABLE';
 end if;

 if exists(
  select 1

  from public.appointments x

  where
   x.barbershop_id=p_shop
   and x.client_id=a.client_id
   and x.id<>a.id
   and x.status not in (
    'cancelled',
    'no_show'
   )
   and x.starts_at<
    p_start+
    make_interval(mins=>duration)
   and x.ends_at>p_start
 )
 then
  raise exception 'CLIENT_ALREADY_BOOKED';
 end if;

 if
  a.subscription_id is not null
  and not exists(
   select 1

   from public.client_subscriptions s

   where
    s.id=a.subscription_id
    and s.barbershop_id=p_shop
    and s.status='active'
    and s.expires_at>p_start
    and s.remaining_cuts>0
  )
 then
  raise exception 'NO_ACTIVE_SUBSCRIPTION';
 end if;

 update public.appointments
 set
  starts_at=p_start,
  ends_at=
   p_start+
   make_interval(mins=>duration)
 where id=a.id;

 insert into public.audit_events(
  barbershop_id,
  actor_id,
  action,
  target_id
 )
 values(
  p_shop,
  auth.uid(),
  'appointment.rescheduled',
  a.id
 );

end
$function$;

revoke all
on function public.reschedule_appointment(
 uuid,uuid,timestamptz
)
from public,anon;

grant execute
on function public.reschedule_appointment(
 uuid,uuid,timestamptz
)
to authenticated;


-- ------------------------------------------------------------
-- Feed: perfil público dentro da própria barbearia.
-- Não expõe nome, telefone ou ID do cliente autor da avaliação.
-- ------------------------------------------------------------
create or replace function public.feed_professional_profiles(
 p_shop uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
 result jsonb;
begin

 if public.member_role(p_shop) is null then
  raise exception 'FORBIDDEN';
 end if;

 select coalesce(
  jsonb_agg(
   jsonb_build_object(
    'barber_id',
    provider.user_id,

    'rating_average',
    coalesce(
     (
      select round(
       avg(r.rating)::numeric,
       2
      )
      from public.reviews r
      where
       r.barbershop_id=p_shop
       and r.barber_id=provider.user_id
     ),
     0
    ),

    'review_count',
    (
     select count(*)::int
     from public.reviews r
     where
      r.barbershop_id=p_shop
      and r.barber_id=provider.user_id
    ),

    'completed_count',
    (
     select count(*)::int
     from public.appointments a
     where
      a.barbershop_id=p_shop
      and a.barber_id=provider.user_id
      and a.status='completed'
    ),

    'reviews',
    coalesce(
     (
      select jsonb_agg(
       jsonb_build_object(
        'id',review.id,
        'rating',review.rating,
        'comment',review.comment,
        'created_at',review.created_at
       )
       order by review.created_at desc
      )
      from (
       select
        r.id,
        r.rating,
        r.comment,
        r.created_at
       from public.reviews r
       where
        r.barbershop_id=p_shop
        and r.barber_id=provider.user_id
       order by r.created_at desc
       limit 200
      ) review
     ),
     '[]'::jsonb
    )
   )
   order by provider.display_name
  ),
  '[]'::jsonb
 )
 into result

 from (
  select
   m.user_id,
   m.display_name

  from public.memberships m

  join public.barbershops b
   on b.id=m.barbershop_id

  where
   m.barbershop_id=p_shop
   and m.active
   and (
    m.role='BARBER'
    or (
     m.role='OWNER'
     and b.operation_mode='SOLO'
    )
   )
 ) provider;

 return result;

end
$function$;

revoke all
on function public.feed_professional_profiles(uuid)
from public,anon;

grant execute
on function public.feed_professional_profiles(uuid)
to authenticated;

commit;
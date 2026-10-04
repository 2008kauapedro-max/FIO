-- FIO 2026-10-03
-- Fechamentos excepcionais da barbearia (feriado, fechar mais cedo, folga etc.)

create table if not exists public.shop_closures(
 barbershop_id uuid not null references public.barbershops(id) on delete cascade,
 day date not null,
 created_by uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(barbershop_id,day)
);

alter table public.shop_closures enable row level security;

drop policy if exists shop_closures_member_read on public.shop_closures;
create policy shop_closures_member_read
on public.shop_closures
for select
to authenticated
using (
 exists(
  select 1
  from public.memberships m
  where m.barbershop_id=shop_closures.barbershop_id
   and m.user_id=auth.uid()
   and m.active
 )
);

drop policy if exists shop_closures_owner_write on public.shop_closures;
create policy shop_closures_owner_write
on public.shop_closures
for all
to authenticated
using (
 exists(
  select 1
  from public.memberships m
  where m.barbershop_id=shop_closures.barbershop_id
   and m.user_id=auth.uid()
   and m.role='OWNER'
   and m.active
 )
)
with check (
 exists(
  select 1
  from public.memberships m
  where m.barbershop_id=shop_closures.barbershop_id
   and m.user_id=auth.uid()
   and m.role='OWNER'
   and m.active
 )
);

create index if not exists shop_closures_day_idx
on public.shop_closures(barbershop_id,day);

-- Segurança real: mesmo uma chamada direta ao backend não pode reservar dia fechado.
create or replace function fio_private.slot_fits(
 p_shop uuid,
 p_barber uuid,
 p_service uuid,
 p_start timestamptz,
 p_ignore uuid default null
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
 join public.barbershops b on b.id=s.barbershop_id
 where s.id=p_service
  and s.barbershop_id=p_shop
  and s.active
  and fio_private.is_provider(p_shop,p_barber)
  and p_start>now()
  and p_start<=now()+interval '60 days'

  and not exists(
   select 1
   from public.shop_closures c
   where c.barbershop_id=p_shop
    and c.day=(p_start at time zone b.timezone)::date
  )

  and not exists(
   select 1
   from public.staff_service_rules r
   where r.barbershop_id=p_shop
    and r.barber_id=p_barber
    and r.service_id=p_service
    and not r.enabled
  )

  and exists(
   select 1
   from public.business_hours h
   where h.barbershop_id=p_shop
    and h.weekday=extract(dow from p_start at time zone b.timezone)
    and (p_start at time zone b.timezone)::time>=h.opens_at
    and ((p_start+make_interval(mins=>s.duration_minutes)) at time zone b.timezone)::date=(p_start at time zone b.timezone)::date
    and ((p_start+make_interval(mins=>s.duration_minutes)) at time zone b.timezone)::time<=h.closes_at
  )

  and (
   not exists(
    select 1 from public.staff_hours h
    where h.barbershop_id=p_shop and h.barber_id=p_barber
   )
   or exists(
    select 1
    from public.staff_hours h
    where h.barbershop_id=p_shop
     and h.barber_id=p_barber
     and h.weekday=extract(dow from p_start at time zone b.timezone)
     and (p_start at time zone b.timezone)::time>=h.opens_at
     and ((p_start+make_interval(mins=>s.duration_minutes)) at time zone b.timezone)::time<=h.closes_at
   )
  )

  and not exists(
   select 1
   from public.staff_blocks x
   where x.barbershop_id=p_shop
    and x.barber_id=p_barber
    and x.starts_at<p_start+make_interval(mins=>s.duration_minutes)
    and x.ends_at>p_start
  )

  and not exists(
   select 1
   from public.appointments a
   where a.barbershop_id=p_shop
    and a.barber_id=p_barber
    and a.id is distinct from p_ignore
    and a.status not in ('cancelled','no_show')
    and a.starts_at<p_start+make_interval(mins=>s.duration_minutes)
    and a.ends_at>p_start
  )
 );
$function$;
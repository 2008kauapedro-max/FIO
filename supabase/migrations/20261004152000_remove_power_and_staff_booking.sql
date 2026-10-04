begin;

-- O controle manual de abrir/fechar sai do MVP.
-- Limpa fechamentos antigos para não deixar dias bloqueados sem interface de gestão.
delete from public.shop_closures;

-- BARBER continua podendo visualizar/gerenciar seus atendimentos existentes,
-- mas não pode criar um novo agendamento em nome de cliente.
-- Preserva a implementação atual inteira atrás de um wrapper.
alter function public.book_appointment(uuid,uuid,uuid,uuid,timestamptz,boolean)
 rename to book_appointment_before_staff_lock;

alter function public.book_appointment_before_staff_lock(uuid,uuid,uuid,uuid,timestamptz,boolean)
 set schema fio_private;

revoke all
on function fio_private.book_appointment_before_staff_lock(uuid,uuid,uuid,uuid,timestamptz,boolean)
from public,anon,authenticated;

create function public.book_appointment(
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
begin
 if public.member_role(p_shop)='BARBER' then
  raise exception 'FORBIDDEN';
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
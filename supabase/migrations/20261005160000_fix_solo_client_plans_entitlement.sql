begin;

-- O código da aplicação já libera pacotes de cortes para SOLO,
-- mas a policy do banco ainda consultava a regra antiga.
-- Mantemos as regras existentes e alinhamos client_plans
-- com os planos atuais do FIO.

create or replace function public.fio_feature_allowed(
 p_shop uuid,
 p_feature text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select case p_feature
  when 'assistant'
   then public.effective_fio_plan(p_shop)
        in ('PRO','PREMIUM')

  when 'feed'
   then public.effective_fio_plan(p_shop)
        in ('PRO','PREMIUM')

  when 'communication'
   then public.effective_fio_plan(p_shop)
        in ('PRO','PREMIUM')

  when 'client_plans'
   then public.effective_fio_plan(p_shop)
        in (
         'SOLO',
         'SOLO_PREMIUM',
         'PRO',
         'PLUS',
         'PREMIUM'
        )

  else false
 end
$$;

revoke all
on function public.fio_feature_allowed(uuid,text)
from public,anon;

grant execute
on function public.fio_feature_allowed(uuid,text)
to authenticated,service_role;

commit;

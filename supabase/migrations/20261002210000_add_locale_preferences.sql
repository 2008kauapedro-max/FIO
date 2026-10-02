-- FIO MVP — idioma, região e moeda preferidos por usuário dentro da barbearia.
-- O FIO usa public.memberships (chave composta barbershop_id + user_id).

alter table public.memberships
  add column if not exists preferred_locale text not null default 'pt-BR',
  add column if not exists preferred_region text not null default 'BR',
  add column if not exists preferred_currency text not null default 'BRL';

alter table public.memberships drop constraint if exists memberships_preferred_locale_check;
alter table public.memberships add constraint memberships_preferred_locale_check
  check (preferred_locale in ('pt-BR','en','es','fr','de','it'));

alter table public.memberships drop constraint if exists memberships_preferred_region_check;
alter table public.memberships add constraint memberships_preferred_region_check
  check (preferred_region ~ '^[A-Z]{2}$');

alter table public.memberships drop constraint if exists memberships_preferred_currency_check;
alter table public.memberships add constraint memberships_preferred_currency_check
  check (preferred_currency in ('BRL','USD','EUR','GBP','MXN','ARS'));

comment on column public.memberships.preferred_locale is
  'Idioma preferido da interface e da IA: pt-BR, en, es, fr, de ou it.';
comment on column public.memberships.preferred_region is
  'Região ISO 3166-1 alpha-2 usada para preferências e formatação.';
comment on column public.memberships.preferred_currency is
  'Moeda preferida de exibição. O checkout pode continuar limitado à moeda do provedor.';

create or replace function public.set_locale_preferences(
  p_shop uuid,
  p_locale text,
  p_region text,
  p_currency text
) returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_locale not in ('pt-BR','en','es','fr','de','it')
     or p_region !~ '^[A-Z]{2}$'
     or p_currency not in ('BRL','USD','EUR','GBP','MXN','ARS') then
    raise exception 'INVALID_DATA' using errcode='22023';
  end if;

  update public.memberships
     set preferred_locale=p_locale,
         preferred_region=p_region,
         preferred_currency=p_currency
   where barbershop_id=p_shop
     and user_id=auth.uid()
     and active;

  if not found then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
end $$;

revoke all on function public.set_locale_preferences(uuid,text,text,text) from public,anon;
grant execute on function public.set_locale_preferences(uuid,text,text,text) to authenticated;

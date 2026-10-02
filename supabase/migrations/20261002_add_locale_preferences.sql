-- FIO MVP — idioma, região e moeda preferidos.
-- Ajuste "public.profiles" somente se a tabela de perfil do seu projeto tiver outro nome.

alter table public.profiles
  add column if not exists preferred_locale text not null default 'pt-BR',
  add column if not exists preferred_region text not null default 'BR',
  add column if not exists preferred_currency text not null default 'BRL';

alter table public.profiles
  drop constraint if exists profiles_preferred_locale_check;

alter table public.profiles
  add constraint profiles_preferred_locale_check
  check (preferred_locale in ('pt-BR', 'en', 'es', 'fr', 'de', 'it'));

alter table public.profiles
  drop constraint if exists profiles_preferred_currency_check;

alter table public.profiles
  add constraint profiles_preferred_currency_check
  check (preferred_currency in ('BRL', 'USD', 'EUR', 'GBP', 'MXN', 'ARS'));

comment on column public.profiles.preferred_locale is
  'Idioma preferido da interface e da IA: pt-BR, en, es, fr, de ou it.';

comment on column public.profiles.preferred_region is
  'Região ISO 3166-1 alpha-2 usada para formatação e preferências.';

comment on column public.profiles.preferred_currency is
  'Moeda preferida de exibição. O provedor de pagamento pode impor outra moeda no checkout.';

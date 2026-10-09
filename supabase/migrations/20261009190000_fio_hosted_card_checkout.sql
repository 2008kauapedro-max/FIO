-- Ativacao do checkout hospedado de cartao da SyncPay.
-- Restrito a service_role; nenhum acesso direto do cliente ao armazenamento de vinculos.
create table if not exists public.fio_hosted_checkout_intents (
 id uuid primary key default gen_random_uuid(),
 barbershop_id uuid not null references public.barbershops(id) on delete cascade,
 actor_user_id uuid not null references auth.users(id) on delete cascade,
 customer_email text not null,
 plan_code text not null check(plan_code in ('SOLO','SOLO_PREMIUM','PRO','PREMIUM')),
 billing_cycle text not null default 'monthly' check(billing_cycle='monthly'),
 amount_cents integer not null check(amount_cents>0),
 provider_plan_token text,
 checkout_url text,
 provider_subscription_token text unique,
 state text not null check(state in ('creating','ready','linked','failed','review','cancelled')) default 'creating',
 terms_version text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists fio_hosted_one_pending_per_email
 on public.fio_hosted_checkout_intents (customer_email)
 where state in ('creating','ready');
create unique index if not exists fio_hosted_one_pending_per_shop
 on public.fio_hosted_checkout_intents (barbershop_id)
 where state in ('creating','ready');
create index if not exists fio_hosted_plan_pending
 on public.fio_hosted_checkout_intents (provider_plan_token)
 where state='ready';
alter table public.fio_hosted_checkout_intents enable row level security;
revoke all on public.fio_hosted_checkout_intents from anon,authenticated;
grant all on public.fio_hosted_checkout_intents to service_role;

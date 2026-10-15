-- FIO: registro INDIVIDUAL de compras anuais avulsas.
-- ARQUIVO DE PREPARACAO. Nao executa sozinho e nao habilita cobrancas.
-- Aplicar em ambiente de teste primeiro, depois revisar o webhook e a funcao
-- transacional de concessao de acesso. Nunca liberar acesso so pelo return_url.
create table if not exists public.fio_annual_orders (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  actor_user_id uuid not null,
  external_id text not null unique,
  plan_code text not null check (plan_code in ('SOLO','SOLO_PREMIUM','PRO','PREMIUM')),
  billing_cycle text not null default 'annual' check (billing_cycle = 'annual'),
  base_amount_cents integer not null check (base_amount_cents > 0),
  currency text not null default 'BRL' check (currency='BRL'),
  installments_max integer not null default 12 check (installments_max between 1 and 12),
  installment_fees_payer text not null default 'customer' check (installment_fees_payer='customer'),
  state text not null default 'preparing'
    check (state in ('preparing','checkout_ready','review','paid','failed','cancelled','refunded')),
  provider_order_id text unique,
  provider_transaction_id text unique,
  checkout_url text,
  verified_at timestamptz,
  paid_at timestamptz,
  access_starts_at timestamptz,
  access_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint annual_checkout_ready_has_url check (state <> 'checkout_ready' or checkout_url is not null),
  constraint annual_paid_is_verified check (state <> 'paid' or (verified_at is not null and paid_at is not null and provider_order_id is not null))
);
create unique index if not exists fio_annual_orders_one_open_per_shop
  on public.fio_annual_orders(barbershop_id)
  where state in ('preparing','checkout_ready','review');
create index if not exists fio_annual_orders_shop_time
  on public.fio_annual_orders(barbershop_id,created_at desc);
alter table public.fio_annual_orders enable row level security;
-- No anon/authenticated policies: service role only.
-- A criacao por API devera usar acesso autenticado OWNER e idempotencia.
-- Nenhum gatilho de pagamento/ativacao e criado aqui.

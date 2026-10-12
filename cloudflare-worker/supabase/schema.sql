-- Run in Supabase SQL Editor. The service-role key is server-only and must never be exposed to the browser.
create table if not exists public.paliaai_payments (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  razorpay_payment_id text not null unique,
  razorpay_payment_link_id text not null,
  amount_paise integer not null check (amount_paise in (4900, 39900)),
  plan text not null check (plan in ('monthly', 'yearly')),
  status text not null check (status = 'paid'),
  paid_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.paliaai_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly')),
  status text not null check (status in ('active', 'expired', 'cancelled')),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  last_payment_id text not null,
  updated_at timestamptz not null default now()
);
alter table public.paliaai_payments enable row level security;
alter table public.paliaai_subscriptions enable row level security;
-- No client policies: only the Cloudflare Worker service-role key may read/write these tables.

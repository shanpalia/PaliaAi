-- Run in Supabase SQL Editor. Firebase UIDs are text, not Supabase auth.users UUIDs.
create table if not exists public.paliaai_payments (
  id bigint generated always as identity primary key,
  user_id text not null,
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
  user_id text primary key,
  plan text not null check (plan in ('monthly', 'yearly')),
  status text not null check (status in ('active', 'expired', 'cancelled')),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  last_payment_id text not null,
  updated_at timestamptz not null default now()
);
alter table public.paliaai_payments enable row level security;
alter table public.paliaai_subscriptions enable row level security;
-- Do not add public/client policies. Only the Worker service-role key may access these tables.

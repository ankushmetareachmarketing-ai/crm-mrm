alter table public.payments
  add column if not exists account_name text,
  add column if not exists account_holder text;
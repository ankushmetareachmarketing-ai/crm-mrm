-- The Owner asked to be able to see employees' login passwords (current and
-- earlier). Logins still check the bcrypt hash; alongside it we keep every
-- password that gets set, encrypted with CREDENTIALS_ENCRYPTION_KEY (same
-- scheme as the credentials vault). Only the Owner can read it, and every
-- read is written to employee_history. Passwords set before this table
-- existed were never stored reversibly, so they can't be shown.

create table public.employee_password_vault (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  value_encrypted text not null,
  set_by_employee_id uuid references public.employees (id) on delete set null,
  set_at timestamptz not null default now()
);

create index employee_password_vault_employee_idx on public.employee_password_vault (employee_id, set_at desc);

-- Nobody reads this through Supabase's public APIs; the app reads it
-- server-side with the service connection after checking the caller is the Owner.
alter table public.employee_password_vault enable row level security;

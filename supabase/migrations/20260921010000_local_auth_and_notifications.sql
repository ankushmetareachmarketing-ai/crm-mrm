-- Move off Supabase Auth to a self-contained model: NextAuth (Credentials
-- provider) + bcrypt password hashes stored directly on public.employees.
-- The app connects to this database as a trusted server-side role and
-- enforces authorization in application code, so RLS is no longer the
-- enforcement boundary here.

drop table if exists public.employees cascade;

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  login_id text not null unique,
  password_hash text not null,
  employment_type text not null check (employment_type in ('Full-time', 'Part-time', 'Contract')),
  access_profile_id uuid not null references public.access_profiles (id),
  joining_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index employees_access_profile_id_idx on public.employees (access_profile_id);

alter table public.access_profiles disable row level security;
alter table public.employees disable row level security;

create table public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index password_reset_tokens_employee_id_idx on public.password_reset_tokens (employee_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  detail text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Access profiles: the role definitions ("Owner", "Sales", "HR", ...)
create table public.access_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null,
  data_scope text not null,
  created_at timestamptz not null default now()
);

-- Employees: one row per employee, one-to-one with an auth.users login
create table public.employees (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  contact text not null,
  login_id text not null unique,
  employment_type text not null check (employment_type in ('Full-time', 'Part-time', 'Contract')),
  access_profile_id uuid not null references public.access_profiles (id),
  joining_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index employees_access_profile_id_idx on public.employees (access_profile_id);

alter table public.access_profiles enable row level security;
alter table public.employees enable row level security;

-- Any signed-in employee can read the profile/role list and the employee directory.
-- Writes only ever happen from server-side API routes using the service role key,
-- which bypasses RLS, after checking the caller is an Owner.
create policy "Authenticated users can read access profiles"
  on public.access_profiles for select
  to authenticated
  using (true);

create policy "Authenticated users can read employees"
  on public.employees for select
  to authenticated
  using (true);

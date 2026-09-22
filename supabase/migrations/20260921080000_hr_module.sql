-- HR module: employee salary, a dynamic per-employee credentials vault
-- (encrypted at rest, every change tracked), and real attendance tracking
-- with a half-day rule and manual penalties.

alter table public.employees
  add column salary numeric;

create table public.employee_credentials (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  label text not null,
  value_encrypted text not null,
  created_by_employee_id uuid references public.employees (id),
  updated_by_employee_id uuid references public.employees (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index employee_credentials_employee_idx on public.employee_credentials (employee_id);

-- Every create/update/delete on a credential is recorded here, independent
-- of the live row (so history survives a delete). Old values are kept
-- encrypted too, but the API never decrypts/returns them — the log exists
-- to show who changed what and when, not to resurface superseded secrets.
create table public.employee_credential_history (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null,
  employee_id uuid not null references public.employees (id) on delete cascade,
  label text not null,
  action text not null check (action in ('Created', 'Updated', 'Deleted')),
  previous_value_encrypted text,
  changed_by_employee_id uuid references public.employees (id),
  changed_at timestamptz not null default now()
);

create index employee_credential_history_employee_idx on public.employee_credential_history (employee_id);
create index employee_credential_history_credential_idx on public.employee_credential_history (credential_id);

create table public.attendance_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  work_date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  status text not null default 'Present' check (status in ('Present', 'Half Day', 'Absent', 'On Leave')),
  penalty_amount numeric not null default 0,
  penalty_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create index attendance_entries_employee_date_idx on public.attendance_entries (employee_id, work_date);
create index attendance_entries_work_date_idx on public.attendance_entries (work_date);

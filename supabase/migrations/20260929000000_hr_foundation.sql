-- HR foundation: organisation structure (departments, designations, teams,
-- reporting managers), a fuller employee record (employee code, status,
-- personal/contact details), documents, notes, change history, leave,
-- self check-in attendance rules, onboarding (checklist, policies, assets).

-- ---------------------------------------------------------------------
-- Organisation
-- ---------------------------------------------------------------------

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  head_employee_id uuid references public.employees (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.designations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department_id uuid references public.departments (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (name, department_id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department_id uuid references public.departments (id) on delete set null,
  lead_employee_id uuid references public.employees (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (name, department_id)
);

-- ---------------------------------------------------------------------
-- Employee record
-- ---------------------------------------------------------------------

create sequence public.employee_code_seq start 1;

alter table public.employees
  add column employee_code text unique,
  add column department_id uuid references public.departments (id) on delete set null,
  add column designation_id uuid references public.designations (id) on delete set null,
  add column team_id uuid references public.teams (id) on delete set null,
  add column reporting_manager_id uuid references public.employees (id) on delete set null,
  -- Where the person is in their employment. Separate from `active`, which
  -- only controls whether they can log in.
  add column status text not null default 'Active' check (
    status in ('Onboarding', 'Probation', 'Active', 'Notice Period', 'Resigned', 'Terminated', 'Inactive')
  ),
  add column gender text,
  add column marital_status text,
  add column blood_group text,
  add column personal_email text,
  add column work_email text,
  add column alternate_phone text,
  add column exit_date date;

-- Existing staff get codes in joining order.
update public.employees e
set employee_code = 'EMP-' || lpad(n.rn::text, 4, '0')
from (select id, row_number() over (order by joining_date, created_at) as rn from public.employees) n
where n.id = e.id;

select setval('public.employee_code_seq', greatest((select count(*) from public.employees), 1));

alter table public.employees alter column employee_code set default
  'EMP-' || lpad(nextval('public.employee_code_seq')::text, 4, '0');
alter table public.employees alter column employee_code set not null;

update public.employees set status = 'Inactive' where not active;

-- The old free-text department becomes a real department.
insert into public.departments (name)
select distinct trim(department) from public.employees
where department is not null and trim(department) <> ''
on conflict (name) do nothing;

update public.employees e set department_id = d.id
from public.departments d
where e.department is not null and d.name = trim(e.department);

create index employees_department_idx on public.employees (department_id);
create index employees_manager_idx on public.employees (reporting_manager_id);
create index employees_status_idx on public.employees (status);

create table public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  category text not null default 'Other' check (
    category in ('ID Proof', 'Address Proof', 'Education', 'Experience', 'Offer Letter', 'Contract', 'Other')
  ),
  title text not null,
  -- Path inside the private "employee-documents" storage bucket; files are
  -- only ever served through short-lived signed URLs after an access check.
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes integer,
  uploaded_by_employee_id uuid references public.employees (id) on delete set null,
  created_at timestamptz not null default now()
);

create index employee_documents_employee_idx on public.employee_documents (employee_id);

create table public.employee_notes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  author_employee_id uuid references public.employees (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index employee_notes_employee_idx on public.employee_notes (employee_id, created_at desc);

-- Everything that changed about an employee: field edits, transfers,
-- promotions, status and role changes, onboarding steps.
create table public.employee_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  actor_employee_id uuid references public.employees (id) on delete set null,
  action text not null,
  field text,
  before_value text,
  after_value text,
  created_at timestamptz not null default now()
);

create index employee_history_employee_idx on public.employee_history (employee_id, created_at desc);

insert into public.employee_history (employee_id, action, created_at)
select id, 'Joined', coalesce(joining_date::timestamptz, created_at) from public.employees;

-- ---------------------------------------------------------------------
-- Attendance rules (single-row settings) and leave
-- ---------------------------------------------------------------------

create table public.hr_settings (
  id boolean primary key default true check (id),
  office_start time not null default '10:00',
  office_end time not null default '19:00',
  grace_minutes integer not null default 15 check (grace_minutes between 0 and 180),
  full_day_hours numeric not null default 8 check (full_day_hours > 0),
  half_day_hours numeric not null default 4 check (half_day_hours > 0),
  -- 0 = Sunday … 6 = Saturday
  weekly_offs integer[] not null default '{0}',
  updated_at timestamptz not null default now()
);

insert into public.hr_settings default values;

create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  -- null = no yearly limit (e.g. unpaid leave)
  days_per_year numeric,
  paid boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.leave_types (name, days_per_year, paid) values
  ('Casual Leave', 12, true),
  ('Sick Leave', 12, true),
  ('Earned Leave', 15, true),
  ('Unpaid Leave', null, false);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  leave_type_id uuid not null references public.leave_types (id),
  start_date date not null,
  end_date date not null,
  half_day boolean not null default false,
  days numeric not null check (days > 0),
  reason text,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected', 'Cancelled')),
  decided_by_employee_id uuid references public.employees (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index leave_requests_employee_idx on public.leave_requests (employee_id, start_date desc);
create index leave_requests_status_idx on public.leave_requests (status);

-- ---------------------------------------------------------------------
-- Onboarding: checklist, policies, assets
-- ---------------------------------------------------------------------

create table public.onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Other' check (
    category in ('Documents', 'Policies', 'IT & Assets', 'Introductions', 'Other')
  ),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.onboarding_templates (title, category, sort_order) values
  ('Collect ID proof (Aadhaar / PAN)', 'Documents', 10),
  ('Collect address proof', 'Documents', 20),
  ('Collect education & experience certificates', 'Documents', 30),
  ('Share and sign offer letter', 'Documents', 40),
  ('Employee reads and accepts company policies', 'Policies', 50),
  ('Assign department, designation and manager', 'Other', 60),
  ('Hand over laptop / SIM / ID card', 'IT & Assets', 70),
  ('Create login and share credentials', 'IT & Assets', 80),
  ('Introduce to team and reporting manager', 'Introductions', 90);

create table public.employee_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  title text not null,
  category text not null default 'Other',
  sort_order integer not null default 0,
  done_at timestamptz,
  done_by_employee_id uuid references public.employees (id) on delete set null,
  created_at timestamptz not null default now()
);

create index employee_onboarding_tasks_employee_idx on public.employee_onboarding_tasks (employee_id, sort_order);

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  active boolean not null default true,
  created_by_employee_id uuid references public.employees (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.policy_acknowledgements (
  policy_id uuid not null references public.policies (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  primary key (policy_id, employee_id)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_tag text not null unique,
  name text not null,
  category text not null default 'Other' check (
    category in ('Laptop', 'Desktop', 'Mobile', 'SIM Card', 'ID Card', 'Headset', 'Other')
  ),
  serial_number text,
  status text not null default 'Available' check (status in ('Available', 'Assigned', 'Under Repair', 'Retired')),
  notes text,
  created_at timestamptz not null default now()
);

create table public.asset_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  returned_at timestamptz,
  assigned_by_employee_id uuid references public.employees (id) on delete set null,
  notes text
);

create index asset_assignments_employee_idx on public.asset_assignments (employee_id);
create unique index asset_assignments_one_open_idx on public.asset_assignments (asset_id) where returned_at is null;

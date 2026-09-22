-- Round 1 foundation for the MetaReach Sales CRM upgrade: additive schema
-- only (new nullable columns, new tables) so no existing row is ever
-- invalidated. See C:\Users\Ankush Singh\.claude\plans\fizzy-gliding-reddy.md
-- for the full plan this implements.

-- ---------------------------------------------------------------------
-- leads: richer identification/source/qualification fields
-- ---------------------------------------------------------------------

alter table public.leads
  add column first_name text,
  add column last_name text,
  add column mobile text,
  add column whatsapp_number text,
  add column alternate_phone text,
  add column email text,
  add column alternate_email text,
  add column linkedin_url text,
  add column gstin text,
  add column pan text,
  add column city text,
  add column state text,
  add column country text,
  add column pincode text,
  add column source_campaign text,
  add column source_medium text,
  add column source_detail text,
  add column referral_name text,
  add column landing_page text,
  add column utm_source text,
  add column utm_medium text,
  add column utm_campaign text,
  add column utm_term text,
  add column utm_content text,
  add column temperature text check (temperature in ('Cold', 'Warm', 'Hot')),
  add column expected_monthly_revenue numeric,
  add column decision_timeline text,
  add column decision_maker text,
  add column competitor text,
  add column current_provider text,
  add column current_price numeric,
  add column lead_score integer;

-- Widen stage/priority to the full pipeline. Both new lists are strict
-- supersets of the current values, so every existing row stays valid.
alter table public.leads drop constraint leads_stage_check;
alter table public.leads add constraint leads_stage_check check (
  stage in (
    'New', 'Contacted', 'Qualified', 'Requirement Collected',
    'Demo Scheduled', 'Meeting Scheduled', 'Proposal Required',
    'Quotation Sent', 'Negotiation', 'On Hold', 'Won', 'Lost'
  )
);

alter table public.leads drop constraint leads_priority_check;
alter table public.leads add constraint leads_priority_check check (
  priority in ('Low', 'Medium', 'High', 'Urgent')
);

-- ---------------------------------------------------------------------
-- lead_services: normalized service interest (never comma-separated)
-- ---------------------------------------------------------------------

create table public.lead_services (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null references public.leads (id) on delete cascade,
  service_key text not null,
  requirement text,
  estimated_volume numeric,
  expected_monthly_spend numeric,
  current_provider text,
  current_rate numeric,
  quoted_rate numeric,
  notes text,
  priority text,
  status text not null default 'New',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lead_services_lead_id_idx on public.lead_services (lead_id);
create index lead_services_service_key_idx on public.lead_services (service_key);

-- ---------------------------------------------------------------------
-- entity_requirements: polymorphic, shared by leads and clients
-- (reuses the entity_type/entity_id pattern activity_log already uses)
-- ---------------------------------------------------------------------

create table public.entity_requirements (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lead', 'client')),
  entity_id text not null,
  service_key text,
  title text not null,
  description text,
  quantity numeric,
  unit text,
  frequency text,
  budget numeric,
  deadline date,
  priority text,
  status text not null default 'New' check (
    status in ('New', 'Gathering Information', 'Confirmed', 'Quoted', 'In Discussion', 'Completed', 'Cancelled')
  ),
  owner_employee_id uuid references public.employees (id),
  created_by_employee_id uuid references public.employees (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index entity_requirements_entity_idx on public.entity_requirements (entity_type, entity_id);
create index entity_requirements_status_idx on public.entity_requirements (status);

-- ---------------------------------------------------------------------
-- notes: polymorphic, replaces client_notes (leads get notes too now)
-- ---------------------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lead', 'client')),
  entity_id text not null,
  author_employee_id uuid references public.employees (id),
  body text not null,
  is_internal boolean not null default true,
  created_at timestamptz not null default now()
);

create index notes_entity_idx on public.notes (entity_type, entity_id, created_at desc);

insert into public.notes (entity_type, entity_id, author_employee_id, body, created_at)
select 'client', client_id, author_employee_id, body, created_at
from public.client_notes;

drop table public.client_notes;

-- ---------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  entity_type text check (entity_type in ('lead', 'client')),
  entity_id text,
  assigned_employee_id uuid references public.employees (id),
  created_by_employee_id uuid references public.employees (id),
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  due_date date,
  due_time time,
  status text not null default 'Pending' check (status in ('Pending', 'In Progress', 'Completed', 'Cancelled')),
  completed_at timestamptz,
  completed_by_employee_id uuid references public.employees (id),
  created_at timestamptz not null default now()
);

create index tasks_assigned_employee_idx on public.tasks (assigned_employee_id);
create index tasks_entity_idx on public.tasks (entity_type, entity_id);
create index tasks_due_date_idx on public.tasks (due_date);
create index tasks_status_idx on public.tasks (status);

-- ---------------------------------------------------------------------
-- follow_ups
-- ---------------------------------------------------------------------

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lead', 'client')),
  entity_id text not null,
  employee_id uuid references public.employees (id),
  follow_up_date date not null,
  follow_up_time time,
  follow_up_type text,
  outcome text check (
    outcome in (
      'Interested', 'Call Back', 'Meeting Required', 'Demo Required',
      'Quotation Required', 'Negotiation', 'No Response', 'Not Interested',
      'Won', 'Lost', 'Other'
    )
  ),
  notes text,
  next_follow_up_date date,
  next_follow_up_time time,
  status text not null default 'Pending' check (status in ('Pending', 'Completed', 'Cancelled')),
  created_at timestamptz not null default now()
);

create index follow_ups_entity_idx on public.follow_ups (entity_type, entity_id);
create index follow_ups_employee_idx on public.follow_ups (employee_id);
create index follow_ups_follow_up_date_idx on public.follow_ups (follow_up_date);
create index follow_ups_next_follow_up_date_idx on public.follow_ups (next_follow_up_date);

-- ---------------------------------------------------------------------
-- activity_log: extend in place instead of a second audit table
-- ---------------------------------------------------------------------

alter table public.activity_log
  add column before_value text,
  add column after_value text;

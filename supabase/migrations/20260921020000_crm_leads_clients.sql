-- Move Leads/Clients off mock data into real, editable, history-tracked
-- records. IDs stay in the existing "LD-####"/"CL-####" text format (not
-- uuid) because lib/mock-data.ts's ledgerEntries/campaigns still reference
-- clients by that exact id — switching schemes would break Client Finance
-- and the /crm/clients/[id] detail route, which are out of scope here.

create table public.leads (
  id text primary key,
  company text not null,
  contact text not null,
  designation text not null default '—',
  source text not null default 'Manual entry',
  industry text not null default 'Unclassified',
  stage text not null default 'New' check (stage in ('New', 'Contacted', 'Meeting Scheduled', 'Won', 'Lost')),
  owner_employee_id uuid references public.employees (id),
  next_action text,
  next_action_due date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id text primary key,
  company text not null,
  industry text not null default 'Unclassified',
  owner_employee_id uuid references public.employees (id),
  status text not null default 'Active' check (status in ('Active', 'On Hold', 'Inactive')),
  balance numeric not null default 0,
  last_receipt_date date,
  since date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients (id) on delete cascade,
  name text not null,
  designation text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients (id) on delete cascade,
  author_employee_id uuid references public.employees (id),
  body text not null,
  created_at timestamptz not null default now()
);

-- Shared activity timeline for both leads and clients.
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lead', 'client')),
  entity_id text not null,
  actor_employee_id uuid references public.employees (id),
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index activity_log_entity_idx on public.activity_log (entity_type, entity_id, created_at desc);
create index leads_owner_idx on public.leads (owner_employee_id);
create index clients_owner_idx on public.clients (owner_employee_id);
create index client_contacts_client_idx on public.client_contacts (client_id);
create index client_notes_client_idx on public.client_notes (client_id);

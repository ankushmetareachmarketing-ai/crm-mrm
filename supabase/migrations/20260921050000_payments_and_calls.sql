-- Payments: full receipt tracking against clients, plus due-date reminders.

create table public.payments (
  id text primary key,
  client_id text not null references public.clients (id) on delete cascade,
  amount numeric not null,
  payment_date date not null default current_date,
  method text,
  reference text,
  status text not null default 'Received' check (status in ('Pending', 'Received', 'Failed', 'Refunded')),
  notes text,
  recorded_by_employee_id uuid references public.employees (id),
  created_at timestamptz not null default now()
);

create index payments_client_id_idx on public.payments (client_id);
create index payments_payment_date_idx on public.payments (payment_date);

create table public.payment_reminders (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients (id) on delete cascade,
  due_date date not null,
  expected_amount numeric,
  status text not null default 'Pending' check (status in ('Pending', 'Done', 'Overdue', 'Cancelled')),
  notes text,
  created_by_employee_id uuid references public.employees (id),
  created_at timestamptz not null default now()
);

create index payment_reminders_client_id_idx on public.payment_reminders (client_id);
create index payment_reminders_due_date_idx on public.payment_reminders (due_date);
create index payment_reminders_status_idx on public.payment_reminders (status);

-- Calls: a self-service cold-call list each employee builds and works
-- themselves (not admin-assigned), plus a log of every call attempt so
-- "how many calls today" can be counted accurately.

create table public.call_list_entries (
  id uuid primary key default gen_random_uuid(),
  owner_employee_id uuid not null references public.employees (id),
  name text,
  phone text not null,
  notes text,
  status text not null default 'Not Called' check (
    status in ('Not Called', 'Interested', 'Not Interested', 'Call Back', 'Invalid Number', 'Converted')
  ),
  last_called_at timestamptz,
  call_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index call_list_entries_owner_idx on public.call_list_entries (owner_employee_id);
create index call_list_entries_status_idx on public.call_list_entries (status);

create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  call_list_entry_id uuid not null references public.call_list_entries (id) on delete cascade,
  employee_id uuid not null references public.employees (id),
  outcome text not null,
  notes text,
  called_at timestamptz not null default now()
);

create index call_logs_entry_idx on public.call_logs (call_list_entry_id);
create index call_logs_employee_called_at_idx on public.call_logs (employee_id, called_at);

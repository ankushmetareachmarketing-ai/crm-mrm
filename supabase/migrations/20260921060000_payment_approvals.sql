-- Payments recorded by a non-trusted role (e.g. Sales) now require HR (or
-- Owner) approval before they count as collected — a sales person marking
-- a payment "Received" shouldn't move the client's balance on its own say.

alter table public.payments
  add column approval_status text not null default 'Pending'
    check (approval_status in ('Pending', 'Approved', 'Rejected')),
  add column approved_by_employee_id uuid references public.employees (id),
  add column approved_at timestamptz;

-- Existing rows were recorded before this gate existed and have already
-- had any balance effect applied — grandfather them in as approved so
-- history doesn't suddenly show as pending.
update public.payments set approval_status = 'Approved', approved_at = created_at;

create index payments_approval_status_idx on public.payments (approval_status);

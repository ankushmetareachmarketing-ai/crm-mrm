-- SMS / Voice campaigns go through the Campaign Manager after the Owner
-- approves the booking: Pending (waiting for the Campaign Manager) →
-- Approved → Running → Completed, or Rejected. Null for non-campaign services.

alter table public.client_charges
  add column campaign_status text check (campaign_status in ('Pending', 'Approved', 'Running', 'Completed', 'Rejected')),
  add column campaign_decided_by_employee_id uuid references public.employees (id) on delete set null,
  add column campaign_decided_at timestamptz,
  add column campaign_note text;

create index client_charges_campaign_status_idx on public.client_charges (campaign_status) where campaign_status is not null;

-- Campaigns the Owner has already approved join the Campaign Manager's queue.
update public.client_charges
set campaign_status = 'Pending'
where kind = 'Service' and approval_status = 'Approved' and service in ('SMS Campaign', 'Voice Campaign');

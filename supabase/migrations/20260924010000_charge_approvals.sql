-- Services booked by Sales now need the Owner's approval before they count
-- toward a client's balance (payments already had this gate; it is now
-- Owner-only for both). Approval time + approver are kept so the client
-- timeline can show who added what and when it took effect.

alter table public.client_charges
  add column approval_status text not null default 'Approved'
    check (approval_status in ('Pending', 'Approved', 'Rejected')),
  add column approved_by_employee_id uuid references public.employees (id),
  add column approved_at timestamptz;

-- Existing rows (opening balances, services booked before this gate) have
-- already moved the balance — grandfather them in as approved.
update public.client_charges set approved_at = created_at where approved_at is null;

alter table public.client_charges alter column approval_status set default 'Pending';

create index client_charges_approval_status_idx on public.client_charges (approval_status);
create index payments_charge_id_idx on public.payments (charge_id);

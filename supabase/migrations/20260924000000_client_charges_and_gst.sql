-- Credit sales ledger: a client takes services now (billed at their own
-- per-message rate) and pays later. Every service taken is a charge row;
-- every payment is a credit against it. The client's due is always
-- charges - approved received payments, so month-by-month history (opening
-- balance carried forward, billed, received, closing) can be derived.
--
-- GST: a charge is either "With GST" (18% added on top of the ex-GST base)
-- or "Non GST". Both the base and the GST-inclusive total are stored, since
-- Sales dashboards show ex-GST figures while the Owner sees both.

create table public.client_charges (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients (id) on delete cascade,
  -- 'Opening balance' rows carry forward each client's balance from before
  -- this ledger existed (see backfill below); everything else is 'Service'.
  kind text not null default 'Service' check (kind in ('Service', 'Opening balance')),
  -- 'SMS', 'RCS', 'WhatsApp', 'IVR', 'OBD', or any custom service name.
  service text not null,
  quantity numeric not null,
  rate numeric not null,
  base_amount numeric not null,
  gst_type text not null default 'Non GST' check (gst_type in ('With GST', 'Non GST')),
  gst_amount numeric not null default 0,
  total_amount numeric not null,
  charge_date date not null default current_date,
  -- Agreed at the time the service is booked: pay later on credit, pay in
  -- full now, or pay part now and the rest later (by due_date).
  payment_terms text not null default 'Pay later' check (payment_terms in ('Pay later', 'Paid in full', 'Part payment')),
  due_date date,
  notes text,
  recorded_by_employee_id uuid references public.employees (id),
  created_at timestamptz not null default now()
);

create index client_charges_client_id_idx on public.client_charges (client_id);
create index client_charges_charge_date_idx on public.client_charges (charge_date);

-- Payments get the same GST split so a GST-inclusive receipt can be shown
-- ex-GST to Sales. Existing payments predate GST tracking: treat as Non GST.
alter table public.payments
  add column gst_type text not null default 'Non GST' check (gst_type in ('With GST', 'Non GST')),
  add column base_amount numeric,
  -- Set when the payment was taken while booking a service.
  add column charge_id uuid references public.client_charges (id) on delete set null;

update public.payments set base_amount = amount;

alter table public.payments alter column base_amount set not null;

-- Backfill: clients.balance already reflects (untracked opening dues -
-- approved received payments). Add one 'Opening balance' charge per client
-- so the ledger reconciles to the existing balance exactly.
insert into public.client_charges
  (client_id, kind, service, quantity, rate, base_amount, gst_type, gst_amount, total_amount, charge_date, notes)
select c.id, 'Opening balance', 'Opening balance', 1, o.amount, o.amount, 'Non GST', 0, o.amount, c.since,
       'Balance carried forward from before service tracking'
from public.clients c
cross join lateral (
  select c.balance + coalesce((
    select sum(p.amount) from public.payments p
    where p.client_id = c.id and p.approval_status = 'Approved' and p.status = 'Received'
  ), 0) as amount
) o
where o.amount <> 0;

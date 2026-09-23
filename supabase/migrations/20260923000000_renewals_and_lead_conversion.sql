-- Client renewal/expiry tracking, and a real link between a won lead and
-- the client record it converts into. Previously leads and clients were
-- entirely separate manual entries with no conversion path.

alter table public.clients
  add column renewal_date date;

alter table public.leads
  add column converted_client_id text references public.clients (id),
  add column converted_at timestamptz;

create index clients_renewal_date_idx on public.clients (renewal_date);

-- Richer master-data fields for clients, leads and employees.

alter table public.clients
  add column website text,
  add column logo_url text,
  add column gstin text,
  add column company_size text,
  add column address_line1 text,
  add column address_line2 text,
  add column city text,
  add column state text,
  add column pincode text,
  add column country text not null default 'India',
  add column description text;

alter table public.leads
  add column website text,
  add column company_size text,
  add column budget numeric,
  add column priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  add column expected_close_date date;

alter table public.employees
  add column photo_url text,
  add column date_of_birth date,
  add column address text,
  add column department text,
  add column emergency_contact_name text,
  add column emergency_contact_phone text;

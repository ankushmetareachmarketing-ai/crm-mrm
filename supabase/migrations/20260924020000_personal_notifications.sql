-- Notifications become personal: each row belongs to one employee, links
-- to the page it is about, and has its own read state. Previously every
-- notification was global and "mark read" cleared it for everyone.

alter table public.notifications
  add column recipient_employee_id uuid references public.employees (id) on delete cascade,
  add column actor_employee_id uuid references public.employees (id) on delete set null,
  add column kind text,
  add column link text;

-- Existing global notifications (new-employee alerts and old seed data) go
-- to every active Owner and HR, keeping their read state; only the
-- new-employee ones get a link. Then drop the recipient-less originals.
insert into public.notifications (title, detail, created_at, read_at, recipient_employee_id, kind, link)
select n.title, n.detail, n.created_at, n.read_at, e.id, 'employee',
       case when n.title like 'New employee%' then '/hr/employees' end
from public.notifications n
cross join public.employees e
join public.access_profiles p on p.id = e.access_profile_id
where n.recipient_employee_id is null and e.active and p.name in ('Owner', 'HR');

delete from public.notifications where recipient_employee_id is null;

alter table public.notifications alter column recipient_employee_id set not null;

create index notifications_recipient_idx on public.notifications (recipient_employee_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_employee_id) where read_at is null;

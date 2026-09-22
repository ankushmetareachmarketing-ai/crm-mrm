insert into public.access_profiles (id, name, description, data_scope) values
  ('00000000-0000-0000-0000-000000000001', 'Owner', 'Full access — all records, approvals, configuration', 'All records'),
  ('00000000-0000-0000-0000-000000000002', 'Sales', 'Assigned leads, clients, campaign requests, own claims', 'Assigned records'),
  ('00000000-0000-0000-0000-000000000003', 'Campaign Manager', 'Approved campaigns, execution, results, actual cost', 'Execution queue'),
  ('00000000-0000-0000-0000-000000000004', 'HR', 'Attendance, leave, configured HR tasks', 'HR module only'),
  ('00000000-0000-0000-0000-000000000005', 'Support/DLT', 'Assigned tickets and DLT work only', 'Assigned tickets');

insert into public.notifications (title, detail) values
  ('Vendor low balance', 'Kridha Communications — Voice-Panel-C nearing limit'),
  ('Missing evening cost report', 'Campaign Manager has not submitted actuals for CMP-5522'),
  ('Overdue follow-up', 'Sundar Finserv — next action was due yesterday');

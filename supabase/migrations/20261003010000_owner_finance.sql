-- Owner finance: company expenses, so each month's income (approved client
-- payments) can be set against what was spent to show profit.

create table public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category text not null check (
    category in ('Salary', 'Rent', 'Vendor / SMS cost', 'Electricity & Internet', 'Marketing', 'Software', 'Travel', 'Office', 'Tax', 'Other')
  ),
  description text not null,
  amount numeric not null check (amount > 0),
  paid_to text,
  payment_method text,
  reference text,
  -- Set for salary rows created from an employee, so a month's salaries
  -- aren't added twice for the same person.
  employee_id uuid references public.employees (id) on delete set null,
  created_by_employee_id uuid references public.employees (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index finance_expenses_date_idx on public.finance_expenses (expense_date);
create unique index finance_expenses_one_salary_per_month_idx
  on public.finance_expenses (employee_id, (extract(year from expense_date) * 100 + extract(month from expense_date)))
  where category = 'Salary' and employee_id is not null;

alter table public.finance_expenses enable row level security;

import "server-only"
import { pool } from "@/lib/db"
import type { ExpenseCategory, ExpenseRow, FinanceBreakdownRow, MonthFinance, SalaryCandidate } from "@/lib/finance"

const round2 = (n: number) => Math.round(n * 100) / 100

/** Income, billing and expense totals for each of the given YYYY-MM months. */
export async function getMonthlyFinance(months: string[]): Promise<MonthFinance[]> {
  if (months.length === 0) return []
  const { rows } = await pool.query<{
    month: string
    collected_total: string
    collected_base: string
    payments_count: number
    billed_total: string
    billed_gst: string
    billed_base: string
    expenses: string
  }>(
    `with m as (select unnest($1::text[]) as month)
     select m.month,
       coalesce((select sum(amount) from public.payments
                 where status = 'Received' and approval_status = 'Approved'
                   and to_char(payment_date, 'YYYY-MM') = m.month), 0)::text as collected_total,
       coalesce((select sum(base_amount) from public.payments
                 where status = 'Received' and approval_status = 'Approved'
                   and to_char(payment_date, 'YYYY-MM') = m.month), 0)::text as collected_base,
       (select count(*)::int from public.payments
        where status = 'Received' and approval_status = 'Approved'
          and to_char(payment_date, 'YYYY-MM') = m.month) as payments_count,
       coalesce((select sum(total_amount) from public.client_charges
                 where kind = 'Service' and approval_status = 'Approved'
                   and to_char(charge_date, 'YYYY-MM') = m.month), 0)::text as billed_total,
       coalesce((select sum(gst_amount) from public.client_charges
                 where kind = 'Service' and approval_status = 'Approved'
                   and to_char(charge_date, 'YYYY-MM') = m.month), 0)::text as billed_gst,
       coalesce((select sum(base_amount) from public.client_charges
                 where kind = 'Service' and approval_status = 'Approved'
                   and to_char(charge_date, 'YYYY-MM') = m.month), 0)::text as billed_base,
       coalesce((select sum(amount) from public.finance_expenses
                 where to_char(expense_date, 'YYYY-MM') = m.month), 0)::text as expenses
     from m`,
    [months]
  )
  return rows.map((r) => {
    const collectedTotal = Number(r.collected_total)
    const collectedBase = Number(r.collected_base)
    const expenses = Number(r.expenses)
    return {
      month: r.month,
      collectedTotal,
      collectedBase,
      collectedGst: round2(collectedTotal - collectedBase),
      paymentsCount: r.payments_count,
      billedTotal: Number(r.billed_total),
      billedGst: Number(r.billed_gst),
      billedBase: Number(r.billed_base),
      expenses,
      profit: round2(collectedBase - expenses),
    }
  })
}

export async function getExpenses(month: string): Promise<ExpenseRow[]> {
  const { rows } = await pool.query<{
    id: string
    expense_date: string
    category: ExpenseCategory
    description: string
    amount: string
    paid_to: string | null
    payment_method: string | null
    reference: string | null
    employee_id: string | null
    created_by: string | null
  }>(
    `select x.id, x.expense_date::text, x.category, x.description, x.amount::text, x.paid_to, x.payment_method,
            x.reference, x.employee_id, c.name as created_by
     from public.finance_expenses x
     left join public.employees c on c.id = x.created_by_employee_id
     where to_char(x.expense_date, 'YYYY-MM') = $1
     order by x.expense_date desc, x.created_at desc`,
    [month]
  )
  return rows.map((r) => ({
    id: r.id,
    date: r.expense_date,
    category: r.category,
    description: r.description,
    amount: Number(r.amount),
    paidTo: r.paid_to,
    paymentMethod: r.payment_method,
    reference: r.reference,
    employeeId: r.employee_id,
    createdBy: r.created_by,
  }))
}

/** Where a month's money came from: by service billed, and by sales person collected. */
export async function getIncomeBreakdown(month: string): Promise<{ byService: FinanceBreakdownRow[]; bySalesPerson: FinanceBreakdownRow[] }> {
  const [services, people] = await Promise.all([
    pool.query<{ name: string; total: string; base: string; count: number }>(
      `select service as name, sum(total_amount)::text as total, sum(base_amount)::text as base, count(*)::int as count
       from public.client_charges
       where kind = 'Service' and approval_status = 'Approved' and to_char(charge_date, 'YYYY-MM') = $1
       group by service order by sum(total_amount) desc`,
      [month]
    ),
    pool.query<{ name: string; total: string; base: string; count: number }>(
      `select coalesce(e.name, 'Not assigned') as name, sum(p.amount)::text as total, sum(p.base_amount)::text as base,
              count(*)::int as count
       from public.payments p
       join public.clients c on c.id = p.client_id
       left join public.employees e on e.id = c.owner_employee_id
       where p.status = 'Received' and p.approval_status = 'Approved' and to_char(p.payment_date, 'YYYY-MM') = $1
       group by e.name order by sum(p.amount) desc`,
      [month]
    ),
  ])
  const map = (r: { name: string; total: string; base: string; count: number }) => ({
    name: r.name,
    total: Number(r.total),
    base: Number(r.base),
    count: r.count,
  })
  return { byService: services.rows.map(map), bySalesPerson: people.rows.map(map) }
}

/** Active employees with a salary set, and whether this month's salary is already recorded. */
export async function getSalaryCandidates(month: string): Promise<SalaryCandidate[]> {
  const { rows } = await pool.query<{ id: string; name: string; salary: string; added: boolean }>(
    `select e.id, e.name, e.salary::text,
            exists (select 1 from public.finance_expenses x
                    where x.employee_id = e.id and x.category = 'Salary' and to_char(x.expense_date, 'YYYY-MM') = $1) as added
     from public.employees e
     where e.active and e.salary is not null and e.salary > 0
     order by e.name`,
    [month]
  )
  return rows.map((r) => ({ employeeId: r.id, name: r.name, salary: Number(r.salary), alreadyAdded: r.added }))
}

/** Total still owed by all clients right now (approved bills − approved payments). */
export async function getOutstandingNow(): Promise<number> {
  const { rows } = await pool.query<{ due: string }>(
    `select coalesce(sum(greatest(due, 0)), 0)::text as due from (
       select c.id,
              coalesce((select sum(total_amount) from public.client_charges where client_id = c.id and approval_status = 'Approved'), 0)
            - coalesce((select sum(amount) from public.payments where client_id = c.id and status = 'Received' and approval_status = 'Approved'), 0) as due
       from public.clients c) t`
  )
  return Number(rows[0].due)
}

import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"

/**
 * Records this month's salary as an expense for each chosen active employee
 * (amount = their monthly salary). Anyone already paid for that month is
 * skipped, so pressing it twice never doubles the cost.
 */
export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  if (caller.role !== "Owner") return NextResponse.json({ error: "Only the Owner can manage finance." }, { status: 403 })

  const body = (await request.json()) ?? {}
  const month = typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month) ? body.month : null
  const ids: string[] = Array.isArray(body.employeeIds) ? body.employeeIds.filter((x: unknown) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)) : []
  if (!month) return NextResponse.json({ error: "Month is invalid." }, { status: 400 })
  if (ids.length === 0) return NextResponse.json({ error: "Choose at least one employee." }, { status: 400 })

  // Salaries are dated the last day of the month.
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10)
  const { rowCount } = await pool.query(
    `insert into public.finance_expenses
       (expense_date, category, description, amount, paid_to, employee_id, created_by_employee_id)
     select $1::date, 'Salary', 'Salary — ' || e.name, e.salary, e.name, e.id, $3
     from public.employees e
     where e.id = any($2::uuid[]) and e.active and e.salary > 0
       and not exists (select 1 from public.finance_expenses x
                       where x.employee_id = e.id and x.category = 'Salary'
                         and to_char(x.expense_date, 'YYYY-MM') = $4)`,
    [lastDay, ids, caller.id, month]
  )
  return NextResponse.json({ added: rowCount ?? 0 })
}

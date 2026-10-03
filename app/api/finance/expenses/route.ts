import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { parseExpense } from "@/lib/finance-server"

/** Owner adds a company expense. */
export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  if (caller.role !== "Owner") return NextResponse.json({ error: "Only the Owner can manage finance." }, { status: 403 })

  const parsed = parseExpense((await request.json()) ?? {})
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const e = parsed.value

  const { rows } = await pool.query<{ id: string }>(
    `insert into public.finance_expenses
       (expense_date, category, description, amount, paid_to, payment_method, reference, created_by_employee_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [e.date, e.category, e.description, e.amount, e.paidTo, e.paymentMethod, e.reference, caller.id]
  )
  return NextResponse.json({ id: rows[0].id }, { status: 201 })
}

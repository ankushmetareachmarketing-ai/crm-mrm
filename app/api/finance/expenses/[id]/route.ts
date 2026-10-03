import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { parseExpense } from "@/lib/finance-server"

async function guard(params: Promise<{ id: string }>) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return { response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) }
  if (caller.role !== "Owner") return { response: NextResponse.json({ error: "Only the Owner can manage finance." }, { status: 403 }) }
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { response: NextResponse.json({ error: "Not found." }, { status: 404 }) }
  return { id }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params)
  if ("response" in g) return g.response
  const parsed = parseExpense((await request.json()) ?? {})
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const e = parsed.value
  const { rowCount } = await pool.query(
    `update public.finance_expenses
     set expense_date = $2, category = $3, description = $4, amount = $5, paid_to = $6, payment_method = $7,
         reference = $8, updated_at = now()
     where id = $1`,
    [g.id, e.date, e.category, e.description, e.amount, e.paidTo, e.paymentMethod, e.reference]
  )
  if (!rowCount) return NextResponse.json({ error: "Not found." }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params)
  if ("response" in g) return g.response
  await pool.query(`delete from public.finance_expenses where id = $1`, [g.id])
  return NextResponse.json({ ok: true })
}

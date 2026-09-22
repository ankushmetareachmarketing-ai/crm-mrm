import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { assertOwnsOrIsOwner, ForbiddenError } from "@/lib/auth/ownership"
import { pool } from "@/lib/db"

export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const body = await request.json()
  const { clientId, dueDate, expectedAmount, notes } = body ?? {}

  if (!clientId || !dueDate) {
    return NextResponse.json({ error: "Client and due date are required." }, { status: 400 })
  }

  const { rows: clientRows } = await pool.query<{ owner_employee_id: string | null }>(
    `select owner_employee_id from public.clients where id = $1`,
    [clientId]
  )
  if (clientRows.length === 0) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  try {
    assertOwnsOrIsOwner(caller, clientRows[0].owner_employee_id)
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  const { rows } = await pool.query(
    `insert into public.payment_reminders (client_id, due_date, expected_amount, notes, created_by_employee_id)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [clientId, dueDate, expectedAmount || null, notes || null, caller.id]
  )

  return NextResponse.json({ id: rows[0].id }, { status: 201 })
}

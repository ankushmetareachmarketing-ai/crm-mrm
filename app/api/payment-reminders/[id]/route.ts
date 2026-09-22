import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { assertOwnsOrIsOwner, ForbiddenError } from "@/lib/auth/ownership"
import { pool } from "@/lib/db"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { status } = body ?? {}

  if (!status) {
    return NextResponse.json({ error: "Status is required." }, { status: 400 })
  }

  const { rows } = await pool.query<{ owner_employee_id: string | null }>(
    `select c.owner_employee_id
     from public.payment_reminders r
     join public.clients c on c.id = r.client_id
     where r.id = $1`,
    [id]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: "Reminder not found." }, { status: 404 })
  }

  try {
    assertOwnsOrIsOwner(caller, rows[0].owner_employee_id)
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  await pool.query(`update public.payment_reminders set status = $1 where id = $2`, [status, id])

  return NextResponse.json({ ok: true })
}

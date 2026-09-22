import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { assertOwnsOrIsOwner, ForbiddenError } from "@/lib/auth/ownership"
import { pool } from "@/lib/db"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { id } = await params

  const { rows: clientRows } = await pool.query<{ owner_employee_id: string | null }>(
    `select owner_employee_id from public.clients where id = $1`,
    [id]
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

  const body = await request.json()
  const { name, designation, phone, email } = body ?? {}

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 })
  }

  const { rows } = await pool.query(
    `insert into public.client_contacts (client_id, name, designation, phone, email)
     values ($1, $2, $3, $4, $5)
     returning id, name, designation, phone, email`,
    [id, name, designation || null, phone || null, email || null]
  )

  await pool.query(
    `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
     values ('client', $1, $2, 'Contact added', $3)`,
    [id, caller.id, name]
  )

  return NextResponse.json({ contact: rows[0] }, { status: 201 })
}

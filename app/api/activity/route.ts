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
  const { entityType, entityId, detail } = body ?? {}

  if (!entityType || !entityId || !detail || !String(detail).trim()) {
    return NextResponse.json({ error: "Pick a record and enter an update." }, { status: 400 })
  }
  if (entityType !== "lead" && entityType !== "client") {
    return NextResponse.json({ error: "Invalid record type." }, { status: 400 })
  }

  const table = entityType === "lead" ? "leads" : "clients"
  const { rows } = await pool.query<{ owner_employee_id: string | null }>(
    `select owner_employee_id from public.${table} where id = $1`,
    [entityId]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: "Record not found." }, { status: 404 })
  }

  try {
    assertOwnsOrIsOwner(caller, rows[0].owner_employee_id)
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  await pool.query(
    `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
     values ($1, $2, $3, 'Note', $4)`,
    [entityType, entityId, caller.id, detail]
  )

  return NextResponse.json({ ok: true }, { status: 201 })
}

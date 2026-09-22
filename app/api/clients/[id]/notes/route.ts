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
  const { body: noteBody } = body ?? {}

  if (!noteBody || !String(noteBody).trim()) {
    return NextResponse.json({ error: "Note can't be empty." }, { status: 400 })
  }

  const { rows } = await pool.query(
    `insert into public.notes (entity_type, entity_id, author_employee_id, body)
     values ('client', $1, $2, $3)
     returning id, body, created_at`,
    [id, caller.id, noteBody]
  )

  await pool.query(
    `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
     values ('client', $1, $2, 'Note added', $3)`,
    [id, caller.id, String(noteBody).slice(0, 140)]
  )

  return NextResponse.json({ note: { ...rows[0], author: caller.name } }, { status: 201 })
}

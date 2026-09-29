import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { canManageHr } from "@/lib/hr/server"

/** HR-only notes on an employee (not visible to the employee). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  if (!canManageHr(caller.role)) return NextResponse.json({ error: "Only HR or the Owner can add notes." }, { status: 403 })

  const { id } = await params
  const body = (await request.json()) ?? {}
  const text = typeof body.body === "string" ? body.body.trim() : ""
  if (!text) return NextResponse.json({ error: "Note can't be empty." }, { status: 400 })
  if (text.length > 4000) return NextResponse.json({ error: "Note is too long." }, { status: 400 })

  const { rows } = await pool.query<{ id: string; created_at: string }>(
    `insert into public.employee_notes (employee_id, author_employee_id, body)
     select $1, $2, $3 where exists (select 1 from public.employees where id = $1)
     returning id, to_json(created_at)#>>'{}' as created_at`,
    [id, caller.id, text]
  )
  if (!rows[0]) return NextResponse.json({ error: "Employee not found." }, { status: 404 })

  return NextResponse.json({ note: { id: rows[0].id, body: text, author: caller.name, createdAt: rows[0].created_at } }, { status: 201 })
}

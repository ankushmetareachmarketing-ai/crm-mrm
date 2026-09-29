import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { canManageHr } from "@/lib/hr/server"
import { notify } from "@/lib/notifications"

/** HR publishes a company policy; every active employee is asked to read and accept it. */
export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  if (!canManageHr(caller.role)) return NextResponse.json({ error: "Only HR or the Owner can do this." }, { status: 403 })

  const body = (await request.json()) ?? {}
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const text = typeof body.body === "string" ? body.body.trim() : ""
  if (!title || title.length > 200) return NextResponse.json({ error: "Title is required (max 200 characters)." }, { status: 400 })
  if (!text || text.length > 20000) return NextResponse.json({ error: "Policy text is required." }, { status: 400 })

  const { rows } = await pool.query<{ id: string }>(
    `insert into public.policies (title, body, created_by_employee_id) values ($1, $2, $3) returning id`,
    [title, text, caller.id]
  )
  await notify({
    everyone: true,
    actorId: caller.id,
    kind: "employee",
    title: "New company policy",
    detail: `Please read and accept "${title}".`,
    link: "/me",
  })
  return NextResponse.json({ id: rows[0].id }, { status: 201 })
}

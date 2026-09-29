import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { canManageHr } from "@/lib/hr/server"

/** Edit a policy or switch it off. Editing the text asks everyone to accept it again. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  if (!canManageHr(caller.role)) return NextResponse.json({ error: "Only HR or the Owner can do this." }, { status: 403 })

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 })
  const body = (await request.json()) ?? {}

  const sets: string[] = []
  const values: unknown[] = []
  if (typeof body.title === "string") {
    if (!body.title.trim()) return NextResponse.json({ error: "Title can't be empty." }, { status: 400 })
    values.push(body.title.trim())
    sets.push(`title = $${values.length}`)
  }
  if (typeof body.body === "string") {
    if (!body.body.trim()) return NextResponse.json({ error: "Policy text can't be empty." }, { status: 400 })
    values.push(body.body.trim())
    sets.push(`body = $${values.length}`)
  }
  if (typeof body.active === "boolean") {
    values.push(body.active)
    sets.push(`active = $${values.length}`)
  }
  if (sets.length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 })

  values.push(id)
  const { rowCount } = await pool.query(
    `update public.policies set ${sets.join(", ")}, updated_at = now() where id = $${values.length}`,
    values
  )
  if (!rowCount) return NextResponse.json({ error: "Not found." }, { status: 404 })
  if (typeof body.body === "string") {
    await pool.query(`delete from public.policy_acknowledgements where policy_id = $1`, [id])
  }
  return NextResponse.json({ ok: true })
}

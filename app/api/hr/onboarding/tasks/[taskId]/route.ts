import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { canManageHr, recordEmployeeHistory } from "@/lib/hr/server"

/** Tick or untick an onboarding checklist item (HR / Owner). DELETE removes it. */
export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  if (!canManageHr(caller.role)) return NextResponse.json({ error: "Only HR or the Owner can do this." }, { status: 403 })

  const { taskId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(taskId)) return NextResponse.json({ error: "Not found." }, { status: 404 })
  const done = Boolean(((await request.json()) ?? {}).done)

  const { rows } = await pool.query<{ employee_id: string; title: string }>(
    `update public.employee_onboarding_tasks
     set done_at = case when $2 then coalesce(done_at, now()) else null end,
         done_by_employee_id = case when $2 then $3::uuid else null end
     where id = $1
     returning employee_id, title`,
    [taskId, done, caller.id]
  )
  if (!rows[0]) return NextResponse.json({ error: "Not found." }, { status: 404 })
  if (done) {
    await recordEmployeeHistory(pool, [
      { employeeId: rows[0].employee_id, actorId: caller.id, action: "Onboarding step done", after: rows[0].title },
    ])
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  if (!canManageHr(caller.role)) return NextResponse.json({ error: "Only HR or the Owner can do this." }, { status: 403 })
  const { taskId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(taskId)) return NextResponse.json({ error: "Not found." }, { status: 404 })
  await pool.query(`delete from public.employee_onboarding_tasks where id = $1`, [taskId])
  return NextResponse.json({ ok: true })
}

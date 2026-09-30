import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { canManageHr } from "@/lib/hr/server"
import { notify } from "@/lib/notifications"

const STATUSES = ["Pending", "In Progress", "Completed", "Cancelled"]

/** The assignee (or whoever gave it, or HR) updates a task's status. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 })

  const status = ((await request.json()) ?? {}).status
  if (!STATUSES.includes(status)) return NextResponse.json({ error: "Status is invalid." }, { status: 400 })

  const { rows } = await pool.query<{ title: string; assigned_employee_id: string | null; created_by_employee_id: string | null }>(
    `select title, assigned_employee_id, created_by_employee_id from public.tasks where id = $1`,
    [id]
  )
  const task = rows[0]
  if (!task) return NextResponse.json({ error: "Not found." }, { status: 404 })
  if (task.assigned_employee_id !== caller.id && task.created_by_employee_id !== caller.id && !canManageHr(caller.role)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  await pool.query(
    `update public.tasks
     set status = $2,
         completed_at = case when $2 = 'Completed' then now() else null end,
         completed_by_employee_id = case when $2 = 'Completed' then $3::uuid else null end
     where id = $1`,
    [id, status, caller.id]
  )
  if (status === "Completed" && task.created_by_employee_id && task.created_by_employee_id !== caller.id) {
    await notify({
      employeeIds: [task.created_by_employee_id],
      actorId: caller.id,
      kind: "employee",
      title: "Task completed",
      detail: `${caller.name} finished: ${task.title}`,
      link: "/me/tasks",
    })
  }
  return NextResponse.json({ ok: true })
}

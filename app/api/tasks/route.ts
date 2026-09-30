import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { canManageHr } from "@/lib/hr/server"
import { notify } from "@/lib/notifications"
import { isValidDateString } from "@/lib/validate"

const PRIORITIES = ["Low", "Medium", "High", "Urgent"]

/** Give someone a task. HR / Owner can assign anyone; a manager can assign their own reports. */
export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = (await request.json()) ?? {}
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const assigneeId = typeof body.assigneeId === "string" ? body.assigneeId : ""
  if (!title || title.length > 200) return NextResponse.json({ error: "Task title is required (max 200 characters)." }, { status: 400 })
  if (!/^[0-9a-f-]{36}$/i.test(assigneeId)) return NextResponse.json({ error: "Choose who the task is for." }, { status: 400 })
  if (body.dueDate && !isValidDateString(body.dueDate)) return NextResponse.json({ error: "Due date is invalid." }, { status: 400 })
  const priority = PRIORITIES.includes(body.priority) ? body.priority : "Medium"

  const { rows } = await pool.query<{ name: string; reporting_manager_id: string | null }>(
    `select name, reporting_manager_id from public.employees where id = $1 and active`,
    [assigneeId]
  )
  const assignee = rows[0]
  if (!assignee) return NextResponse.json({ error: "Employee not found." }, { status: 404 })
  if (!canManageHr(caller.role) && assignee.reporting_manager_id !== caller.id && assigneeId !== caller.id) {
    return NextResponse.json({ error: "You can only give tasks to your own team." }, { status: 403 })
  }

  const { rows: saved } = await pool.query<{ id: string }>(
    `insert into public.tasks (title, description, assigned_employee_id, created_by_employee_id, priority, due_date)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [title, typeof body.description === "string" ? body.description.trim().slice(0, 2000) || null : null, assigneeId, caller.id, priority, body.dueDate || null]
  )
  await notify({
    employeeIds: [assigneeId],
    actorId: caller.id,
    kind: "employee",
    title: "New task for you",
    detail: `${caller.name}: ${title}${body.dueDate ? ` (due ${body.dueDate})` : ""}`,
    link: "/me/tasks",
  })
  return NextResponse.json({ id: saved[0].id }, { status: 201 })
}

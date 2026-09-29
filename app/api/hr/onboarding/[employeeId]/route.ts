import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import { createOnboardingTasks } from "@/lib/hr/onboarding"
import { canManageHr, recordEmployeeHistory } from "@/lib/hr/server"
import { notify } from "@/lib/notifications"

async function guard(params: Promise<{ employeeId: string }>) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return { response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) }
  if (!canManageHr(caller.role)) {
    return { response: NextResponse.json({ error: "Only HR or the Owner can do this." }, { status: 403 }) }
  }
  const { employeeId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(employeeId)) {
    return { response: NextResponse.json({ error: "Employee not found." }, { status: 404 }) }
  }
  return { caller, employeeId }
}

/**
 * POST { action: "start" }    — (re)start onboarding: status Onboarding + checklist.
 * POST { action: "activate", status: "Probation" | "Active" }
 *                             — finish onboarding: turn on login and set status.
 * POST { action: "addTask", title, category } — add a one-off checklist item.
 */
export async function POST(request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const g = await guard(params)
  if ("response" in g) return g.response
  const { caller, employeeId } = g
  const body = (await request.json()) ?? {}

  const db = await pool.connect()
  try {
    await db.query("begin")
    const { rows } = await db.query<{ name: string; status: string; active: boolean }>(
      `select name, status, active from public.employees where id = $1 for update`,
      [employeeId]
    )
    const emp = rows[0]
    if (!emp) {
      await db.query("rollback")
      return NextResponse.json({ error: "Employee not found." }, { status: 404 })
    }

    if (body.action === "start") {
      await db.query(`update public.employees set status = 'Onboarding' where id = $1`, [employeeId])
      await createOnboardingTasks(db, employeeId)
      await recordEmployeeHistory(db, [
        { employeeId, actorId: caller.id, action: "Onboarding started", field: "Status", before: emp.status, after: "Onboarding" },
      ])
    } else if (body.action === "activate") {
      const status = body.status === "Active" ? "Active" : "Probation"
      await db.query(`update public.employees set status = $2, active = true where id = $1`, [employeeId, status])
      await recordEmployeeHistory(db, [
        { employeeId, actorId: caller.id, action: "Employee activated", field: "Status", before: emp.status, after: status },
      ])
      await notify(
        {
          employeeIds: [employeeId],
          actorId: caller.id,
          kind: "employee",
          title: "Welcome aboard!",
          detail: "Your account is active. Check your profile, policies and onboarding checklist.",
          link: "/me",
        },
        db
      )
    } else if (body.action === "addTask") {
      const title = typeof body.title === "string" ? body.title.trim() : ""
      if (!title || title.length > 200) {
        await db.query("rollback")
        return NextResponse.json({ error: "Task title is required (max 200 characters)." }, { status: 400 })
      }
      await db.query(
        `insert into public.employee_onboarding_tasks (employee_id, title, category, sort_order)
         values ($1, $2, $3, coalesce((select max(sort_order) from public.employee_onboarding_tasks where employee_id = $1), 0) + 10)`,
        [employeeId, title, typeof body.category === "string" && body.category ? body.category : "Other"]
      )
    } else {
      await db.query("rollback")
      return NextResponse.json({ error: "Unknown action." }, { status: 400 })
    }

    await db.query("commit")
  } catch (error) {
    await db.query("rollback")
    logError("hr.onboarding", error, { employeeId, action: body.action })
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 })
  } finally {
    db.release()
  }

  revalidateTag("employees-list", "max")
  return NextResponse.json({ ok: true })
}

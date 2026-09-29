import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import { leaveDays } from "@/lib/hr/leave"
import { canManageHr, getHrSettings, getLeaveBalances } from "@/lib/hr/server"
import { notify } from "@/lib/notifications"
import { isValidDateString } from "@/lib/validate"

/** Apply for leave (for yourself; HR may also file it on an employee's behalf). */
export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = (await request.json()) ?? {}
  const employeeId: string = body.employeeId && canManageHr(caller.role) ? body.employeeId : caller.id
  const { leaveTypeId, startDate, endDate, halfDay, reason } = body

  if (!leaveTypeId || !isValidDateString(startDate) || !isValidDateString(endDate)) {
    return NextResponse.json({ error: "Choose the leave type and dates." }, { status: 400 })
  }
  if (endDate < startDate) return NextResponse.json({ error: "End date can't be before the start date." }, { status: 400 })
  if (halfDay && startDate !== endDate) {
    return NextResponse.json({ error: "A half day must start and end on the same date." }, { status: 400 })
  }
  if (typeof reason === "string" && reason.length > 1000) {
    return NextResponse.json({ error: "Reason is too long." }, { status: 400 })
  }

  const settings = await getHrSettings()
  const days = leaveDays(startDate, endDate, Boolean(halfDay), settings)
  if (days <= 0) return NextResponse.json({ error: "Those dates are all weekly offs." }, { status: 400 })

  const [{ rows: typeRows }, { rows: overlap }, { rows: empRows }] = await Promise.all([
    pool.query<{ name: string; days_per_year: string | null }>(
      `select name, days_per_year::text from public.leave_types where id = $1 and active`,
      [leaveTypeId]
    ),
    pool.query(
      `select 1 from public.leave_requests
       where employee_id = $1 and status in ('Pending', 'Approved') and start_date <= $3 and end_date >= $2`,
      [employeeId, startDate, endDate]
    ),
    pool.query<{ name: string; reporting_manager_id: string | null }>(
      `select name, reporting_manager_id from public.employees where id = $1`,
      [employeeId]
    ),
  ])
  const type = typeRows[0]
  if (!type) return NextResponse.json({ error: "Leave type not found." }, { status: 400 })
  if (!empRows[0]) return NextResponse.json({ error: "Employee not found." }, { status: 404 })
  if (overlap.length > 0) return NextResponse.json({ error: "You already have leave on some of these dates." }, { status: 400 })

  if (type.days_per_year !== null) {
    const balance = (await getLeaveBalances(employeeId, Number(startDate.slice(0, 4)))).find(
      (b) => b.leaveTypeId === leaveTypeId
    )
    const available = (balance?.remaining ?? 0) - (balance?.pending ?? 0)
    if (days > available) {
      return NextResponse.json(
        { error: `Only ${available} ${type.name} day${available === 1 ? "" : "s"} left this year (including pending requests).` },
        { status: 400 }
      )
    }
  }

  try {
    const { rows } = await pool.query<{ id: string }>(
      `insert into public.leave_requests (employee_id, leave_type_id, start_date, end_date, half_day, days, reason)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [employeeId, leaveTypeId, startDate, endDate, Boolean(halfDay), days, reason?.trim() || null]
    )
    await notify({
      roles: ["HR"],
      employeeIds: [empRows[0].reporting_manager_id],
      actorId: caller.id,
      kind: "employee",
      title: "Leave request",
      detail: `${empRows[0].name} asked for ${days} day${days === 1 ? "" : "s"} of ${type.name} (${startDate}${
        endDate !== startDate ? ` to ${endDate}` : ""
      }).`,
      link: "/hr/leave",
    })
    return NextResponse.json({ id: rows[0].id, days }, { status: 201 })
  } catch (error) {
    logError("leave.create", error, { employeeId })
    return NextResponse.json({ error: "Could not save the request. Please try again." }, { status: 500 })
  }
}

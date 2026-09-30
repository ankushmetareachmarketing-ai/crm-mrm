import "server-only"
import { notFound } from "next/navigation"
import type { PoolClient } from "pg"
import { getCurrentEmployee, type CurrentEmployee } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { DEFAULT_HR_SETTINGS, type HrSettings } from "@/lib/hr/attendance"
import type { LeaveBalance } from "@/lib/hr/leave"
import type { Role } from "@/lib/types"

/** HR and the Owner manage employees, attendance, leave and onboarding. */
export function canManageHr(role: Role | string) {
  return role === "HR" || role === "Owner"
}

/** For HR-management pages: 404 for anyone who isn't HR or the Owner. */
export async function requireHrManager(): Promise<CurrentEmployee> {
  const me = await getCurrentEmployee()
  if (!canManageHr(me.role)) notFound()
  return me
}

export async function getHrSettings(): Promise<HrSettings> {
  const { rows } = await pool.query<{
    office_start: string
    office_end: string
    lunch_start: string
    lunch_end: string
    grace_minutes: number
    full_day_hours: string
    half_day_hours: string
    weekly_offs: number[]
  }>(
    `select to_char(office_start, 'HH24:MI') as office_start, to_char(office_end, 'HH24:MI') as office_end,
            to_char(lunch_start, 'HH24:MI') as lunch_start, to_char(lunch_end, 'HH24:MI') as lunch_end,
            grace_minutes, full_day_hours::text, half_day_hours::text, weekly_offs
     from public.hr_settings limit 1`
  )
  const r = rows[0]
  if (!r) return DEFAULT_HR_SETTINGS
  return {
    officeStart: r.office_start,
    officeEnd: r.office_end,
    lunchStart: r.lunch_start,
    lunchEnd: r.lunch_end,
    graceMinutes: r.grace_minutes,
    fullDayHours: Number(r.full_day_hours),
    halfDayHours: Number(r.half_day_hours),
    weeklyOffs: r.weekly_offs,
  }
}

interface HistoryInput {
  employeeId: string
  actorId: string | null
  action: string
  field?: string
  before?: string | null
  after?: string | null
}

/** Appends to an employee's history (who changed what, when). */
export async function recordEmployeeHistory(db: PoolClient | typeof pool, entries: HistoryInput[]) {
  for (const e of entries) {
    await db.query(
      `insert into public.employee_history (employee_id, actor_employee_id, action, field, before_value, after_value)
       values ($1, $2, $3, $4, $5, $6)`,
      [e.employeeId, e.actorId, e.action, e.field ?? null, e.before ?? null, e.after ?? null]
    )
  }
}

/** Per-type leave allowance, used and pending days for a calendar year. */
export async function getLeaveBalances(employeeId: string, year: number): Promise<LeaveBalance[]> {
  const { rows } = await pool.query<{
    id: string
    name: string
    paid: boolean
    days_per_year: string | null
    used: string
    pending: string
  }>(
    `select t.id, t.name, t.paid, t.days_per_year::text,
            coalesce(sum(r.days) filter (where r.status = 'Approved'), 0)::text as used,
            coalesce(sum(r.days) filter (where r.status = 'Pending'), 0)::text as pending
     from public.leave_types t
     left join public.leave_requests r
       on r.leave_type_id = t.id and r.employee_id = $1 and extract(year from r.start_date) = $2
     where t.active
     group by t.id
     order by t.paid desc, t.name`,
    [employeeId, year]
  )
  return rows.map((r) => {
    const allowed = r.days_per_year === null ? null : Number(r.days_per_year)
    const used = Number(r.used)
    return {
      leaveTypeId: r.id,
      name: r.name,
      paid: r.paid,
      allowed,
      used,
      pending: Number(r.pending),
      remaining: allowed === null ? null : Math.max(allowed - used, 0),
    }
  })
}

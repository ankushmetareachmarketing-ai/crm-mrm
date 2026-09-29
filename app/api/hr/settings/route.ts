import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { canManageHr } from "@/lib/hr/server"
import { isValidTimeString } from "@/lib/validate"

/** Office hours and attendance rules used for late / early / overtime. */
export async function PATCH(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  if (!canManageHr(caller.role)) return NextResponse.json({ error: "Only HR or the Owner can do this." }, { status: 403 })

  const b = (await request.json()) ?? {}
  if (!isValidTimeString(b.officeStart) || !isValidTimeString(b.officeEnd) || b.officeEnd <= b.officeStart) {
    return NextResponse.json({ error: "Office start and end times are invalid." }, { status: 400 })
  }
  const grace = Number(b.graceMinutes)
  const full = Number(b.fullDayHours)
  const half = Number(b.halfDayHours)
  if (!Number.isInteger(grace) || grace < 0 || grace > 180) {
    return NextResponse.json({ error: "Grace period must be 0–180 minutes." }, { status: 400 })
  }
  if (!(full > 0 && full <= 24) || !(half > 0 && half < full)) {
    return NextResponse.json({ error: "Full-day hours must be more than half-day hours." }, { status: 400 })
  }
  const offs = Array.isArray(b.weeklyOffs) ? b.weeklyOffs.map(Number) : []
  if (offs.some((d: number) => !Number.isInteger(d) || d < 0 || d > 6) || offs.length > 6) {
    return NextResponse.json({ error: "Weekly offs are invalid." }, { status: 400 })
  }

  await pool.query(
    `update public.hr_settings
     set office_start = $1, office_end = $2, grace_minutes = $3, full_day_hours = $4, half_day_hours = $5,
         weekly_offs = $6, updated_at = now()`,
    [b.officeStart, b.officeEnd, grace, full, half, [...new Set(offs)]]
  )
  return NextResponse.json({ ok: true })
}

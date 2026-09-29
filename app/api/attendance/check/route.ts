import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { statusFromWorkedMinutes } from "@/lib/hr/attendance"
import { getHrSettings } from "@/lib/hr/server"
import { OFFICE_TZ } from "@/lib/hr/time"

/** An employee checks themselves in or out for today (office time). */
export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = (await request.json()) ?? {}
  const action = body.action
  if (action !== "in" && action !== "out") {
    return NextResponse.json({ error: 'action must be "in" or "out".' }, { status: 400 })
  }

  const today = `(now() at time zone '${OFFICE_TZ}')::date`
  const { rows } = await pool.query<{
    id: string
    status: string
    check_in_at: string | null
    check_out_at: string | null
  }>(
    `select id, status, to_json(check_in_at)#>>'{}' as check_in_at, to_json(check_out_at)#>>'{}' as check_out_at
     from public.attendance_entries where employee_id = $1 and work_date = ${today}`,
    [caller.id]
  )
  const entry = rows[0]

  if (action === "in") {
    if (entry?.status === "On Leave") {
      return NextResponse.json({ error: "You're on approved leave today." }, { status: 400 })
    }
    if (entry?.check_in_at) {
      return NextResponse.json({ error: "You've already checked in today." }, { status: 400 })
    }
    const { rows: saved } = await pool.query<{ check_in_at: string }>(
      `insert into public.attendance_entries (employee_id, work_date, check_in_at, status)
       values ($1, ${today}, now(), 'Present')
       on conflict (employee_id, work_date) do update set check_in_at = now(), status = 'Present', updated_at = now()
       returning to_json(check_in_at)#>>'{}' as check_in_at`,
      [caller.id]
    )
    return NextResponse.json({ checkInAt: saved[0].check_in_at, checkOutAt: null, status: "Present" })
  }

  if (!entry?.check_in_at) {
    return NextResponse.json({ error: "Check in first." }, { status: 400 })
  }
  if (entry.check_out_at) {
    return NextResponse.json({ error: "You've already checked out today." }, { status: 400 })
  }

  const settings = await getHrSettings()
  const worked = Math.round((Date.now() - new Date(entry.check_in_at).getTime()) / 60000)
  const status = statusFromWorkedMinutes(worked, settings)
  const { rows: saved } = await pool.query<{ check_out_at: string }>(
    `update public.attendance_entries set check_out_at = now(), status = $2, updated_at = now()
     where id = $1
     returning to_json(check_out_at)#>>'{}' as check_out_at`,
    [entry.id, status]
  )
  return NextResponse.json({ checkInAt: entry.check_in_at, checkOutAt: saved[0].check_out_at, status })
}

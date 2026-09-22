import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"

export async function POST() {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { rows } = await pool.query<{ id: string; check_in_at: string | null }>(
    `select id, check_in_at::text from public.attendance_entries
     where employee_id = $1 and work_date = current_date`,
    [caller.id]
  )

  if (rows.length > 0 && rows[0].check_in_at) {
    return NextResponse.json({ error: "You've already checked in today." }, { status: 400 })
  }

  if (rows.length > 0) {
    await pool.query(
      `update public.attendance_entries set check_in_at = now(), updated_at = now() where id = $1`,
      [rows[0].id]
    )
  } else {
    await pool.query(
      `insert into public.attendance_entries (employee_id, work_date, check_in_at, status)
       values ($1, current_date, now(), 'Present')`,
      [caller.id]
    )
  }

  return NextResponse.json({ ok: true, checkInAt: new Date().toISOString() })
}

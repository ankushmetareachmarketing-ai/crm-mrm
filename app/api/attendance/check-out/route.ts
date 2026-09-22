import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"

const HALF_DAY_CUTOFF_HOUR = 14

export async function POST() {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { rows } = await pool.query<{ id: string; check_in_at: string | null; check_out_at: string | null }>(
    `select id, check_in_at::text, check_out_at::text from public.attendance_entries
     where employee_id = $1 and work_date = current_date`,
    [caller.id]
  )

  if (rows.length === 0 || !rows[0].check_in_at) {
    return NextResponse.json({ error: "Check in first." }, { status: 400 })
  }
  if (rows[0].check_out_at) {
    return NextResponse.json({ error: "You've already checked out today." }, { status: 400 })
  }

  const status = new Date().getHours() < HALF_DAY_CUTOFF_HOUR ? "Half Day" : "Present"

  await pool.query(
    `update public.attendance_entries set check_out_at = now(), status = $1, updated_at = now() where id = $2`,
    [status, rows[0].id]
  )

  return NextResponse.json({ ok: true, checkOutAt: new Date().toISOString(), status })
}

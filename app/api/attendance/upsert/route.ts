import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { isNonNegativeNumber, isValidDateString, isValidTimeString } from "@/lib/validate"
import type { AttendanceStatus } from "@/lib/types"

const VALID_STATUSES: AttendanceStatus[] = ["Present", "Half Day", "Absent", "On Leave"]

export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  if (caller.role !== "Owner" && caller.role !== "HR") {
    return NextResponse.json({ error: "Only Owner or HR can edit attendance." }, { status: 403 })
  }

  const body = await request.json()
  const { employeeId, workDate, status, checkInTime, checkOutTime, penaltyAmount, penaltyReason, notes } = body ?? {}

  if (!employeeId || !isValidDateString(workDate) || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "employeeId, workDate and a valid status are required." }, { status: 400 })
  }
  if (checkInTime && !isValidTimeString(checkInTime)) {
    return NextResponse.json({ error: "Check-in time is invalid." }, { status: 400 })
  }
  if (checkOutTime && !isValidTimeString(checkOutTime)) {
    return NextResponse.json({ error: "Check-out time is invalid." }, { status: 400 })
  }
  if (penaltyAmount && !isNonNegativeNumber(penaltyAmount)) {
    return NextResponse.json({ error: "Penalty amount must be a non-negative number." }, { status: 400 })
  }

  const checkInAt = checkInTime ? `${workDate} ${checkInTime}:00` : null
  const checkOutAt = checkOutTime ? `${workDate} ${checkOutTime}:00` : null

  const { rows } = await pool.query<{
    id: string
    check_in_at: string | null
    check_out_at: string | null
    status: string
    penalty_amount: string
    penalty_reason: string | null
    notes: string | null
  }>(
    `insert into public.attendance_entries
       (employee_id, work_date, check_in_at, check_out_at, status, penalty_amount, penalty_reason, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (employee_id, work_date) do update set
       check_in_at = excluded.check_in_at,
       check_out_at = excluded.check_out_at,
       status = excluded.status,
       penalty_amount = excluded.penalty_amount,
       penalty_reason = excluded.penalty_reason,
       notes = excluded.notes,
       updated_at = now()
     returning id, check_in_at::text, check_out_at::text, status, penalty_amount::text, penalty_reason, notes`,
    [
      employeeId,
      workDate,
      checkInAt,
      checkOutAt,
      status,
      penaltyAmount ? Number(penaltyAmount) : 0,
      penaltyReason || null,
      notes || null,
    ]
  )

  const row = rows[0]
  return NextResponse.json({
    id: row.id,
    employeeId,
    workDate,
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    status: row.status,
    penaltyAmount: Number(row.penalty_amount),
    penaltyReason: row.penalty_reason,
    notes: row.notes,
  })
}

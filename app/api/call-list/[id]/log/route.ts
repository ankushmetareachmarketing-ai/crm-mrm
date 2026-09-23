import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import type { CallStatus } from "@/lib/types"

const VALID_STATUSES: CallStatus[] = [
  "Not Called",
  "Interested",
  "Not Interested",
  "Call Back",
  "Invalid Number",
  "Converted",
]

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { outcome, notes, nextFollowUpDate, nextFollowUpTime } = body ?? {}

  if (!outcome || !VALID_STATUSES.includes(outcome)) {
    return NextResponse.json({ error: "A valid outcome is required." }, { status: 400 })
  }

  const { rows } = await pool.query<{ owner_employee_id: string }>(
    `select owner_employee_id from public.call_list_entries where id = $1`,
    [id]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: "Call list entry not found." }, { status: 404 })
  }
  if (caller.role !== "Owner" && rows[0].owner_employee_id !== caller.id) {
    return NextResponse.json({ error: "You don't have access to this record." }, { status: 403 })
  }

  const client = await pool.connect()
  try {
    await client.query("begin")

    await client.query(
      `insert into public.call_logs (call_list_entry_id, employee_id, outcome, notes)
       values ($1, $2, $3, $4)`,
      [id, caller.id, outcome, notes || null]
    )

    await client.query(
      `update public.call_list_entries
       set status = $1, notes = coalesce($2, notes), last_called_at = now(), call_count = call_count + 1,
           next_follow_up_date = $3, next_follow_up_time = $4, updated_at = now()
       where id = $5`,
      [outcome, notes || null, nextFollowUpDate || null, nextFollowUpTime || null, id]
    )

    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    logError("call-list.log", error, { entryId: id, callerId: caller.id })
    return NextResponse.json({ error: "Could not log this call. Please try again." }, { status: 500 })
  } finally {
    client.release()
  }

  return NextResponse.json({ ok: true })
}

import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"

const VALID_STATUSES = new Set([
  "Not Called",
  "Interested",
  "Not Interested",
  "Call Back",
  "Invalid Number",
  "Converted",
])

interface EntryInput {
  name?: string
  phone: string
  notes?: string
  status?: string
}

export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const body = await request.json()
  const entries: EntryInput[] = Array.isArray(body?.entries) ? body.entries : []
  const cleaned = entries
    .map((e) => ({
      name: e.name?.trim() || null,
      phone: e.phone?.trim(),
      notes: e.notes?.trim() || null,
      status: e.status && VALID_STATUSES.has(e.status) ? e.status : "Not Called",
    }))
    .filter((e) => e.phone)

  if (cleaned.length === 0) {
    return NextResponse.json({ error: "At least one valid phone number is required." }, { status: 400 })
  }

  const client = await pool.connect()
  const created: {
    id: string
    name: string | null
    phone: string
    status: string
    notes: string | null
    lastCalledAt: string | null
    callCount: number
    callLog: { id: string; outcome: string; notes: string | null; calledAt: string } | null
  }[] = []
  try {
    await client.query("begin")
    // A number can be added after the call already happened (the employee
    // dials first, then logs it here) — when that's the case the chosen
    // status won't be "Not Called", so we back-fill last_called_at/call_count
    // and write the matching call_logs row in the same transaction, instead
    // of leaving the entry looking never-called.
    for (const entry of cleaned) {
      const alreadyCalled = entry.status !== "Not Called"
      const { rows } = await client.query(
        `insert into public.call_list_entries (owner_employee_id, name, phone, notes, status, last_called_at, call_count)
         values ($1, $2, $3, $4, $5, case when $6 then now() else null end, case when $6 then 1 else 0 end)
         returning id, name, phone, status, notes, last_called_at, call_count`,
        [caller.id, entry.name, entry.phone, entry.notes, entry.status, alreadyCalled]
      )
      const row = rows[0]
      let callLog: { id: string; outcome: string; notes: string | null; calledAt: string } | null = null
      if (alreadyCalled) {
        const { rows: logRows } = await client.query(
          `insert into public.call_logs (call_list_entry_id, employee_id, outcome, notes)
           values ($1, $2, $3, $4)
           returning id, outcome, notes, called_at`,
          [row.id, caller.id, entry.status, entry.notes]
        )
        callLog = {
          id: logRows[0].id,
          outcome: logRows[0].outcome,
          notes: logRows[0].notes,
          calledAt: logRows[0].called_at,
        }
      }
      created.push({
        id: row.id,
        name: row.name,
        phone: row.phone,
        status: row.status,
        notes: row.notes,
        lastCalledAt: row.last_called_at,
        callCount: row.call_count,
        callLog,
      })
    }
    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }

  return NextResponse.json({ entries: created }, { status: 201 })
}

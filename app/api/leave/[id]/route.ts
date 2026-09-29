import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import { isWorkingDay } from "@/lib/hr/attendance"
import { canManageHr, getHrSettings, recordEmployeeHistory } from "@/lib/hr/server"
import { datesBetween } from "@/lib/hr/time"
import { notify } from "@/lib/notifications"

/**
 * HR approves or rejects a request; the employee can cancel their own while
 * it is still pending. Approving marks those working days "On Leave" in
 * attendance (days already checked in are left as they are).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 })
  const body = (await request.json()) ?? {}
  const action = body.action as "approve" | "reject" | "cancel"
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : ""
  if (!["approve", "reject", "cancel"].includes(action)) {
    return NextResponse.json({ error: "action must be approve, reject or cancel." }, { status: 400 })
  }

  const db = await pool.connect()
  try {
    await db.query("begin")
    const { rows } = await db.query<{
      employee_id: string
      employee_name: string
      type_name: string
      start_date: string
      end_date: string
      half_day: boolean
      days: string
      status: string
    }>(
      `select r.employee_id, e.name as employee_name, t.name as type_name, r.start_date::text, r.end_date::text,
              r.half_day, r.days::text, r.status
       from public.leave_requests r
       join public.employees e on e.id = r.employee_id
       join public.leave_types t on t.id = r.leave_type_id
       where r.id = $1 for update of r`,
      [id]
    )
    const req = rows[0]
    if (!req) {
      await db.query("rollback")
      return NextResponse.json({ error: "Not found." }, { status: 404 })
    }

    if (action === "cancel") {
      if (req.employee_id !== caller.id && !canManageHr(caller.role)) {
        await db.query("rollback")
        return NextResponse.json({ error: "You can only cancel your own leave." }, { status: 403 })
      }
      if (req.status !== "Pending") {
        await db.query("rollback")
        return NextResponse.json({ error: "Only a pending request can be cancelled." }, { status: 400 })
      }
    } else {
      if (!canManageHr(caller.role)) {
        await db.query("rollback")
        return NextResponse.json({ error: "Only HR or the Owner can decide leave." }, { status: 403 })
      }
      if (req.employee_id === caller.id && caller.role !== "Owner") {
        await db.query("rollback")
        return NextResponse.json({ error: "You can't approve your own leave." }, { status: 403 })
      }
      if (req.status !== "Pending") {
        await db.query("rollback")
        return NextResponse.json({ error: "This request has already been decided." }, { status: 400 })
      }
    }

    const status = action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "Cancelled"
    await db.query(
      `update public.leave_requests
       set status = $2, decided_by_employee_id = $3, decided_at = now(), decision_note = $4
       where id = $1`,
      [id, status, caller.id, note || null]
    )

    if (status === "Approved") {
      const settings = await getHrSettings()
      const days = datesBetween(req.start_date, req.end_date).filter((d) => isWorkingDay(d, settings))
      for (const day of days) {
        await db.query(
          `insert into public.attendance_entries (employee_id, work_date, status, notes)
           values ($1, $2, $3, $4)
           on conflict (employee_id, work_date) do update
             set status = excluded.status, notes = excluded.notes, updated_at = now()
             where public.attendance_entries.check_in_at is null`,
          [req.employee_id, day, req.half_day ? "Half Day" : "On Leave", `${req.type_name} (approved)`]
        )
      }
      await recordEmployeeHistory(db, [
        {
          employeeId: req.employee_id,
          actorId: caller.id,
          action: "Leave approved",
          field: req.type_name,
          after: `${req.start_date}${req.end_date !== req.start_date ? ` to ${req.end_date}` : ""} (${req.days} days)`,
        },
      ])
    }

    if (action !== "cancel") {
      await notify(
        {
          employeeIds: [req.employee_id],
          actorId: caller.id,
          kind: "approval",
          title: status === "Approved" ? "Leave approved" : "Leave not approved",
          detail: `${req.type_name}, ${req.start_date}${req.end_date !== req.start_date ? ` to ${req.end_date}` : ""}${
            note ? ` — ${note}` : ""
          }`,
          link: "/me/leave",
        },
        db
      )
    }

    await db.query("commit")
    return NextResponse.json({ ok: true, status })
  } catch (error) {
    await db.query("rollback")
    logError("leave.decide", error, { leaveId: id, callerId: caller.id })
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 })
  } finally {
    db.release()
  }
}

import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  if (caller.role !== "Owner" && caller.role !== "HR") {
    return NextResponse.json({ error: "Only Owner or HR can approve payments." }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const decision = body?.decision

  if (decision !== "Approved" && decision !== "Rejected") {
    return NextResponse.json({ error: "decision must be \"Approved\" or \"Rejected\"." }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query("begin")

    const { rows } = await client.query<{
      client_id: string
      amount: string
      payment_date: string
      status: string
      approval_status: string
    }>(
      `select client_id, amount::text, payment_date::text, status, approval_status
       from public.payments where id = $1 for update`,
      [id]
    )
    if (rows.length === 0) {
      await client.query("rollback")
      return NextResponse.json({ error: "Payment not found." }, { status: 404 })
    }
    const payment = rows[0]
    if (payment.approval_status !== "Pending") {
      await client.query("rollback")
      return NextResponse.json({ error: "This payment has already been decided." }, { status: 400 })
    }

    await client.query(
      `update public.payments set approval_status = $1, approved_by_employee_id = $2, approved_at = now()
       where id = $3`,
      [decision, caller.id, id]
    )

    if (decision === "Approved" && payment.status === "Received") {
      await client.query(
        `update public.clients set balance = balance - $1, last_receipt_date = $2 where id = $3`,
        [payment.amount, payment.payment_date, payment.client_id]
      )
    }

    await client.query(
      `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
       values ('client', $1, $2, $3, $4)`,
      [
        payment.client_id,
        caller.id,
        decision === "Approved" ? "Payment approved" : "Payment rejected",
        `₹${payment.amount} payment ${decision.toLowerCase()}`,
      ]
    )

    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    logError("payments.approve", error, { paymentId: id, callerId: caller.id })
    return NextResponse.json({ error: "Could not process this decision. Please try again." }, { status: 500 })
  } finally {
    client.release()
  }

  return NextResponse.json({ ok: true })
}

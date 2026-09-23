import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { assertOwnsOrIsOwner, ForbiddenError } from "@/lib/auth/ownership"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import { isPositiveNumber, isValidDateString } from "@/lib/validate"

export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const body = await request.json()
  const { clientId, amount, paymentDate, method, reference, status, notes } = body ?? {}

  if (!clientId || !isPositiveNumber(amount)) {
    return NextResponse.json({ error: "Client and a positive amount are required." }, { status: 400 })
  }
  if (paymentDate && !isValidDateString(paymentDate)) {
    return NextResponse.json({ error: "Payment date is invalid." }, { status: 400 })
  }

  const { rows: clientRows } = await pool.query<{ owner_employee_id: string | null; company: string }>(
    `select owner_employee_id, company from public.clients where id = $1`,
    [clientId]
  )
  if (clientRows.length === 0) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  try {
    assertOwnsOrIsOwner(caller, clientRows[0].owner_employee_id)
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  const { rows: countRows } = await pool.query(`select count(*)::int as count from public.payments`)
  const id = `PAY-${5000 + countRows[0].count}`
  const resolvedStatus = status || "Received"
  const resolvedDate = paymentDate || new Date().toISOString().slice(0, 10)

  // Owner/HR are trusted to record an already-confirmed payment; anyone
  // else's entry sits as "Pending" approval and doesn't touch the client's
  // balance until an Owner/HR approves it.
  const isTrustedApprover = caller.role === "Owner" || caller.role === "HR"
  const approvalStatus = isTrustedApprover ? "Approved" : "Pending"

  const client = await pool.connect()
  try {
    await client.query("begin")

    await client.query(
      `insert into public.payments
         (id, client_id, amount, payment_date, method, reference, status, notes, recorded_by_employee_id,
          approval_status, approved_by_employee_id, approved_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, case when $10 = 'Approved' then now() else null end)`,
      [
        id,
        clientId,
        amount,
        resolvedDate,
        method || null,
        reference || null,
        resolvedStatus,
        notes || null,
        caller.id,
        approvalStatus,
        isTrustedApprover ? caller.id : null,
      ]
    )

    if (isTrustedApprover && resolvedStatus === "Received") {
      await client.query(
        `update public.clients set balance = balance - $1, last_receipt_date = $2 where id = $3`,
        [amount, resolvedDate, clientId]
      )
    }

    await client.query(
      `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
       values ('client', $1, $2, 'Payment recorded', $3)`,
      [
        clientId,
        caller.id,
        `${resolvedStatus}: ₹${amount}${reference ? ` (${reference})` : ""}${
          isTrustedApprover ? "" : " — pending HR approval"
        }`,
      ]
    )

    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    logError("payments.create", error, { clientId, callerId: caller.id })
    return NextResponse.json({ error: "Could not record this payment. Please try again." }, { status: 500 })
  } finally {
    client.release()
  }

  return NextResponse.json({ id, approvalStatus }, { status: 201 })
}

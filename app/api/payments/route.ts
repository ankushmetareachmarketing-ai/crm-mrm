import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { assertOwnsOrIsOwner, ForbiddenError } from "@/lib/auth/ownership"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import { GST_TYPES, splitPayment, type GstType } from "@/lib/billing"
import { formatCurrency } from "@/lib/format"
import { notify } from "@/lib/notifications"
import { isPositiveNumber, isValidDateString } from "@/lib/validate"

export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const body = await request.json()
  const { clientId, amount, paymentDate, method, reference, status, notes, gstType } = body ?? {}

  if (!clientId || !isPositiveNumber(amount)) {
    return NextResponse.json({ error: "Client and a positive amount are required." }, { status: 400 })
  }
  if (gstType !== undefined && !GST_TYPES.includes(gstType)) {
    return NextResponse.json({ error: "Choose With GST or Non GST." }, { status: 400 })
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

  const resolvedStatus = status || "Received"
  const resolvedDate = paymentDate || new Date().toISOString().slice(0, 10)
  const resolvedGstType: GstType = gstType ?? "Non GST"
  const { base: baseAmount } = splitPayment(Number(amount), resolvedGstType)

  // Only the Owner is trusted to record an already-confirmed payment; anyone
  // else's entry sits as "Pending" approval and doesn't touch the client's
  // balance until the Owner approves it.
  const isTrustedApprover = caller.role === "Owner"
  const approvalStatus = isTrustedApprover ? "Approved" : "Pending"

  let id = ""
  const client = await pool.connect()
  try {
    await client.query("begin")

    // Serialise id allocation so two payments saved at the same moment can't get the same PAY- number.
    await client.query(`lock table public.payments in share row exclusive mode`)
    const { rows: countRows } = await client.query<{ count: number }>(
      `select count(*)::int as count from public.payments`
    )
    id = `PAY-${5000 + countRows[0].count}`

    await client.query(
      `insert into public.payments
         (id, client_id, amount, payment_date, method, reference, status, notes, recorded_by_employee_id,
          approval_status, approved_by_employee_id, approved_at, gst_type, base_amount)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, case when $10 = 'Approved' then now() else null end,
               $12, $13)`,
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
        resolvedGstType,
        baseAmount,
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
          isTrustedApprover ? "" : " — pending Owner approval"
        }`,
      ]
    )

    if (resolvedStatus === "Received") {
      const { company, owner_employee_id: clientOwnerId } = clientRows[0]
      await notify(
        isTrustedApprover
          ? {
              employeeIds: [clientOwnerId],
              actorId: caller.id,
              kind: "payment",
              title: "Payment added",
              detail: `${caller.name} added a ${formatCurrency(Number(amount))} payment for ${company}.`,
              link: `/sales-details/${clientId}`,
            }
          : {
              roles: ["Owner"],
              actorId: caller.id,
              kind: "payment",
              title: "New payment to approve",
              detail: `${caller.name} added a ${formatCurrency(Number(amount))} payment for ${company}.`,
              link: `/sales-details/${clientId}`,
            },
        client
      )
    }

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

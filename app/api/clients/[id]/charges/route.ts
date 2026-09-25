import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { assertOwnsOrIsOwner, ForbiddenError } from "@/lib/auth/ownership"
import {
  computeCharge,
  GST_TYPES,
  isTestingService,
  PAYMENT_TERMS,
  splitPayment,
  type GstType,
  type PaymentTerms,
} from "@/lib/billing"
import { decideCharge } from "@/lib/data/approvals"
import { formatCurrency } from "@/lib/format"
import { notify } from "@/lib/notifications"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import { isNonNegativeNumber, isPositiveNumber, isValidDateString } from "@/lib/validate"

/**
 * Books a service for a client: quantity × their per-unit rate, optionally
 * + 18% GST, together with the payment terms agreed at that moment. Any
 * amount paid now is recorded as a payment against this service. Both stay
 * Pending until the Owner approves the service; on approval the balance
 * moves and anything left on credit with a due date becomes a reminder.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { id } = await params

  const { rows: clientRows } = await pool.query<{ owner_employee_id: string | null; company: string }>(
    `select owner_employee_id, company from public.clients where id = $1`,
    [id]
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

  const body = await request.json()
  const {
    service,
    quantity,
    rate,
    gstType,
    chargeDate,
    notes,
    paymentTerms,
    amountPaidNow,
    paymentMethod,
    paymentReference,
    dueDate,
  } = body ?? {}
  const serviceName = typeof service === "string" ? service.trim() : ""

  if (!serviceName || serviceName.length > 60) {
    return NextResponse.json({ error: "Pick a service or type a custom one (max 60 characters)." }, { status: 400 })
  }
  if (serviceName.toLowerCase() === "opening balance") {
    return NextResponse.json({ error: "That service name is reserved." }, { status: 400 })
  }
  // Test credits may be given free (rate 0); every other service needs a price.
  const isTesting = isTestingService(serviceName)
  if (!isPositiveNumber(quantity) || !(isTesting ? isNonNegativeNumber(rate) : isPositiveNumber(rate))) {
    return NextResponse.json(
      { error: isTesting ? "Enter the test credits, and a rate of 0 or more." : "Quantity and rate must both be more than 0." },
      { status: 400 }
    )
  }
  if (!GST_TYPES.includes(gstType)) {
    return NextResponse.json({ error: "Choose With GST or Non GST." }, { status: 400 })
  }
  if (!PAYMENT_TERMS.includes(paymentTerms)) {
    return NextResponse.json({ error: "Choose the payment terms." }, { status: 400 })
  }
  if (chargeDate && !isValidDateString(chargeDate)) {
    return NextResponse.json({ error: "Service date is invalid." }, { status: 400 })
  }
  if (dueDate && !isValidDateString(dueDate)) {
    return NextResponse.json({ error: "Payment due date is invalid." }, { status: 400 })
  }

  const resolvedGstType = gstType as GstType
  const { base, gst, total } = computeCharge(Number(quantity), Number(rate), resolvedGstType)
  // A free test has nothing to pay, so there is no payment plan to choose.
  const terms: PaymentTerms = total === 0 ? "Paid in full" : (paymentTerms as PaymentTerms)
  const resolvedDate = chargeDate || new Date().toISOString().slice(0, 10)

  let paidNow = 0
  if (terms === "Paid in full") paidNow = total
  if (terms === "Part payment") {
    paidNow = Number(amountPaidNow)
    if (!isPositiveNumber(amountPaidNow) || paidNow >= total) {
      return NextResponse.json(
        { error: "For a part payment, the amount paid now must be more than 0 and less than the total." },
        { status: 400 }
      )
    }
  }
  const remaining = Math.round((total - paidNow) * 100) / 100
  if (remaining > 0 && !dueDate) {
    return NextResponse.json({ error: "Set the date by which the balance will be paid." }, { status: 400 })
  }
  if (dueDate && dueDate < resolvedDate) {
    return NextResponse.json({ error: "Payment due date can't be before the service date." }, { status: 400 })
  }

  // Everything is saved as Pending; the Owner's own bookings are approved on
  // the spot. Approval is what moves the balance (see lib/data/approvals.ts).
  const isOwner = caller.role === "Owner"

  const client = await pool.connect()
  try {
    await client.query("begin")

    const { rows } = await client.query<{ id: string }>(
      `insert into public.client_charges
         (client_id, kind, service, quantity, rate, base_amount, gst_type, gst_amount, total_amount,
          charge_date, payment_terms, due_date, notes, recorded_by_employee_id, approval_status)
       values ($1, 'Service', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'Pending')
       returning id`,
      [
        id,
        serviceName,
        quantity,
        rate,
        base,
        resolvedGstType,
        gst,
        total,
        resolvedDate,
        terms,
        remaining > 0 ? dueDate : null,
        notes || null,
        caller.id,
      ]
    )
    const chargeId = rows[0].id

    await client.query(
      `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
       values ('client', $1, $2, 'Service added', $3)`,
      [
        id,
        caller.id,
        `${serviceName}: ${Number(quantity).toLocaleString("en-IN")} × ₹${rate} = ₹${base}` +
          (resolvedGstType === "With GST" ? ` + GST ₹${gst} = ₹${total}` : " (Non GST)") +
          ` · ${terms}${isOwner ? "" : " — pending Owner approval"}`,
      ]
    )

    let paymentId: string | null = null
    if (paidNow > 0) {
      await client.query(`lock table public.payments in share row exclusive mode`)
      const { rows: countRows } = await client.query<{ count: number }>(
        `select count(*)::int as count from public.payments`
      )
      paymentId = `PAY-${5000 + countRows[0].count}`
      const { base: paidBase } = splitPayment(paidNow, resolvedGstType)

      await client.query(
        `insert into public.payments
           (id, client_id, amount, payment_date, method, reference, status, notes, recorded_by_employee_id,
            approval_status, gst_type, base_amount, charge_id)
         values ($1, $2, $3, $4, $5, $6, 'Received', $7, $8, 'Pending', $9, $10, $11)`,
        [
          paymentId,
          id,
          paidNow,
          resolvedDate,
          paymentMethod || null,
          paymentReference || null,
          `Paid while booking ${serviceName}`,
          caller.id,
          resolvedGstType,
          paidBase,
          chargeId,
        ]
      )

      await client.query(
        `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
         values ('client', $1, $2, 'Payment recorded', $3)`,
        [id, caller.id, `Received: ₹${paidNow} against ${serviceName}`]
      )
    }

    if (isOwner) {
      await decideCharge(client, chargeId, caller.id, "Approved")
    } else {
      await notify(
        {
          roles: ["Owner"],
          actorId: caller.id,
          kind: "service",
          title: isTesting ? `New testing request to approve` : `New ${serviceName} service to approve`,
          detail: isTesting
            ? `${caller.name} wants to give ${clientRows[0].company} ${Number(quantity).toLocaleString("en-IN")} test credits (${serviceName.replace("Testing – ", "")})${
                total > 0 ? ` for ${formatCurrency(total)}` : " free of cost"
              }.`
            : `${caller.name} added ${formatCurrency(total)} for ${clientRows[0].company}${
                paidNow > 0 ? ` (${formatCurrency(paidNow)} paid now)` : ""
              }.`,
          link: `/sales-details/${id}`,
        },
        client
      )
    }

    await client.query("commit")
    return NextResponse.json(
      { id: chargeId, paymentId, base, gst, total, remaining, approvalStatus: isOwner ? "Approved" : "Pending" },
      { status: 201 }
    )
  } catch (error) {
    await client.query("rollback")
    logError("charges.create", error, { clientId: id, callerId: caller.id })
    return NextResponse.json({ error: "Could not save this service. Please try again." }, { status: 500 })
  } finally {
    client.release()
  }
}

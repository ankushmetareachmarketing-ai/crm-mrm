import "server-only"
import type { PoolClient } from "pg"
import { isTestingService, testedServiceOf } from "@/lib/billing"
import { formatCurrency } from "@/lib/format"
import { notify } from "@/lib/notifications"

// Owner-only approval of services (client_charges) and payments. A service
// or payment only moves clients.balance once approved. Every function here
// must run inside the caller's open transaction.

export type Decision = "Approved" | "Rejected"

export class ApprovalError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
    this.name = "ApprovalError"
  }
}

async function logActivity(db: PoolClient, clientId: string, actorId: string, action: string, detail: string) {
  await db.query(
    `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
     values ('client', $1, $2, $3, $4)`,
    [clientId, actorId, action, detail]
  )
}

async function postPayment(db: PoolClient, paymentId: string, approverId: string) {
  const { rows } = await db.query<{ client_id: string; amount: string; payment_date: string; status: string }>(
    `update public.payments set approval_status = 'Approved', approved_by_employee_id = $2, approved_at = now()
     where id = $1
     returning client_id, amount::text, payment_date::text, status`,
    [paymentId, approverId]
  )
  const p = rows[0]
  if (p.status === "Received") {
    await db.query(
      `update public.clients
       set balance = balance - $1, last_receipt_date = greatest(coalesce(last_receipt_date, $2::date), $2::date)
       where id = $3`,
      [p.amount, p.payment_date, p.client_id]
    )
  }
  return p
}

/** Approve or reject a booked service. Its payment taken at booking is decided along with it. */
export async function decideCharge(db: PoolClient, chargeId: string, approverId: string, decision: Decision) {
  const { rows } = await db.query<{
    client_id: string
    company: string
    client_owner_id: string | null
    recorded_by_id: string | null
    service: string
    quantity: string
    total_amount: string
    due_date: string | null
    charge_date: string
    approval_status: string
  }>(
    `select ch.client_id, c.company, c.owner_employee_id as client_owner_id,
            ch.recorded_by_employee_id as recorded_by_id, ch.service, ch.quantity::text, ch.total_amount::text,
            ch.due_date::text, ch.charge_date::text, ch.approval_status
     from public.client_charges ch
     join public.clients c on c.id = ch.client_id
     where ch.id = $1 for update of ch`,
    [chargeId]
  )
  const charge = rows[0]
  if (!charge) throw new ApprovalError("Service not found.", 404)
  if (charge.approval_status !== "Pending") throw new ApprovalError("This service has already been decided.")

  await db.query(
    `update public.client_charges set approval_status = $2, approved_by_employee_id = $3, approved_at = now()
     where id = $1`,
    [chargeId, decision, approverId]
  )

  const { rows: linked } = await db.query<{ id: string; amount: string }>(
    `select id, amount::text from public.payments
     where charge_id = $1 and approval_status = 'Pending' for update`,
    [chargeId]
  )

  if (decision === "Rejected") {
    await db.query(
      `update public.payments set approval_status = 'Rejected', approved_by_employee_id = $2, approved_at = now()
       where charge_id = $1 and approval_status = 'Pending'`,
      [chargeId, approverId]
    )
    await logActivity(db, charge.client_id, approverId, "Service rejected", `${charge.service}: ₹${charge.total_amount}`)
    await notify(
      {
        employeeIds: [charge.recorded_by_id, charge.client_owner_id],
        actorId: approverId,
        kind: "approval",
        title: isTestingService(charge.service) ? "Testing request rejected" : `${charge.service} service rejected`,
        detail: `The Owner rejected the ${formatCurrency(Number(charge.total_amount))} ${charge.service} service for ${charge.company}.`,
        link: `/sales-details/${charge.client_id}`,
      },
      db
    )
    return
  }

  await db.query(`update public.clients set balance = balance + $1 where id = $2`, [
    charge.total_amount,
    charge.client_id,
  ])
  let paidNow = 0
  for (const p of linked) {
    await postPayment(db, p.id, approverId)
    paidNow += Number(p.amount)
  }

  const remaining = Math.round((Number(charge.total_amount) - paidNow) * 100) / 100
  if (remaining > 0 && charge.due_date) {
    await db.query(
      `insert into public.payment_reminders (client_id, due_date, expected_amount, notes, created_by_employee_id)
       values ($1, $2, $3, $4, $5)`,
      [
        charge.client_id,
        charge.due_date,
        remaining,
        `Balance for ${charge.service} booked on ${charge.charge_date}`,
        approverId,
      ]
    )
  }

  await logActivity(
    db,
    charge.client_id,
    approverId,
    "Service approved",
    `${charge.service}: ₹${charge.total_amount}${paidNow > 0 ? ` (₹${paidNow} paid at booking)` : ""}`
  )
  await notify(
    {
      employeeIds: [charge.recorded_by_id, charge.client_owner_id],
      actorId: approverId,
      kind: "approval",
      title: isTestingService(charge.service) ? "Testing request approved" : `${charge.service} service approved`,
      detail:
        isTestingService(charge.service) && Number(charge.total_amount) === 0
          ? `${charge.company} can now use ${Number(charge.quantity).toLocaleString("en-IN")} free ${testedServiceOf(charge.service)} test credits.`
          : `${charge.company}: ${formatCurrency(Number(charge.total_amount))} is now added to the bill${
              paidNow > 0 ? ` and ${formatCurrency(paidNow)} paid is taken off` : ""
            }.`,
      link: `/sales-details/${charge.client_id}`,
    },
    db
  )
}

/** Approve or reject a standalone payment. */
export async function decidePayment(db: PoolClient, paymentId: string, approverId: string, decision: Decision) {
  const { rows } = await db.query<{
    client_id: string
    company: string
    client_owner_id: string | null
    recorded_by_id: string | null
    amount: string
    approval_status: string
    charge_approval_status: string | null
  }>(
    `select p.client_id, c.company, c.owner_employee_id as client_owner_id,
            p.recorded_by_employee_id as recorded_by_id, p.amount::text, p.approval_status,
            ch.approval_status as charge_approval_status
     from public.payments p
     join public.clients c on c.id = p.client_id
     left join public.client_charges ch on ch.id = p.charge_id
     where p.id = $1 for update of p`,
    [paymentId]
  )
  const payment = rows[0]
  if (!payment) throw new ApprovalError("Payment not found.", 404)
  if (payment.approval_status !== "Pending") throw new ApprovalError("This payment has already been decided.")
  if (payment.charge_approval_status === "Pending") {
    throw new ApprovalError("This payment was taken while booking a service — approve the service and it is approved with it.")
  }

  if (decision === "Approved") {
    await postPayment(db, paymentId, approverId)
  } else {
    await db.query(
      `update public.payments set approval_status = 'Rejected', approved_by_employee_id = $2, approved_at = now()
       where id = $1`,
      [paymentId, approverId]
    )
  }

  await logActivity(
    db,
    payment.client_id,
    approverId,
    decision === "Approved" ? "Payment approved" : "Payment rejected",
    `₹${payment.amount} payment ${decision.toLowerCase()}`
  )
  const amount = formatCurrency(Number(payment.amount))
  await notify(
    {
      employeeIds: [payment.recorded_by_id, payment.client_owner_id],
      actorId: approverId,
      kind: "approval",
      title: decision === "Approved" ? "Payment approved" : "Payment rejected",
      detail:
        decision === "Approved"
          ? `${payment.company}: ${amount} is taken off the bill.`
          : `The Owner rejected the ${amount} payment for ${payment.company}.`,
      link: `/sales-details/${payment.client_id}`,
    },
    db
  )
}

import "server-only"
import { pool } from "@/lib/db"
import type { ApprovalStatus, ClientLedgerSummary, GstType, LedgerEntry, PaymentTerms } from "@/lib/billing"

interface SummaryRow {
  id: string
  company: string
  status: string
  owner_employee_id: string | null
  owner_name: string | null
  billed_base: string
  billed_total: string
  received_base: string
  received_total: string
  pending_base: string
  pending_total: string
  pending_services_base: string
  pending_services_total: string
}

/** Per-client billed / received / due totals (Owner-approved only). Pass an employee id to limit to that sales person's clients. */
export async function getClientLedgerSummaries(ownerEmployeeId: string | null): Promise<ClientLedgerSummary[]> {
  const { rows } = await pool.query<SummaryRow>(
    `select c.id, c.company, c.status, c.owner_employee_id, e.name as owner_name,
            coalesce(ch.base, 0)::text as billed_base, coalesce(ch.total, 0)::text as billed_total,
            coalesce(pr.base, 0)::text as received_base, coalesce(pr.total, 0)::text as received_total,
            coalesce(pp.base, 0)::text as pending_base, coalesce(pp.total, 0)::text as pending_total,
            coalesce(pc.base, 0)::text as pending_services_base, coalesce(pc.total, 0)::text as pending_services_total
     from public.clients c
     left join public.employees e on e.id = c.owner_employee_id
     left join lateral (
       select sum(base_amount) as base, sum(total_amount) as total
       from public.client_charges where client_id = c.id and approval_status = 'Approved'
     ) ch on true
     left join lateral (
       select sum(base_amount) as base, sum(total_amount) as total
       from public.client_charges where client_id = c.id and approval_status = 'Pending'
     ) pc on true
     left join lateral (
       select sum(base_amount) as base, sum(amount) as total
       from public.payments
       where client_id = c.id and status = 'Received' and approval_status = 'Approved'
     ) pr on true
     left join lateral (
       select sum(base_amount) as base, sum(amount) as total
       from public.payments
       where client_id = c.id and status = 'Received' and approval_status = 'Pending'
     ) pp on true
     where ($1::uuid is null or c.owner_employee_id = $1::uuid)
     order by c.company`,
    [ownerEmployeeId]
  )

  return rows.map((r) => {
    const billedBase = Number(r.billed_base)
    const billedTotal = Number(r.billed_total)
    const receivedBase = Number(r.received_base)
    const receivedTotal = Number(r.received_total)
    return {
      clientId: r.id,
      company: r.company,
      status: r.status,
      ownerEmployeeId: r.owner_employee_id,
      ownerName: r.owner_name,
      billedBase,
      billedTotal,
      receivedBase,
      receivedTotal,
      pendingApprovalBase: Number(r.pending_base),
      pendingApprovalTotal: Number(r.pending_total),
      pendingServicesBase: Number(r.pending_services_base),
      pendingServicesTotal: Number(r.pending_services_total),
      dueBase: Math.round((billedBase - receivedBase) * 100) / 100,
      dueTotal: Math.round((billedTotal - receivedTotal) * 100) / 100,
    }
  })
}

/** Every charge and payment for one client, as ledger entries (unsorted). */
export async function getClientLedgerEntries(clientId: string): Promise<LedgerEntry[]> {
  const [chargesResult, paymentsResult] = await Promise.all([
    pool.query<{
      id: string
      kind: string
      service: string
      quantity: string
      rate: string
      base_amount: string
      gst_type: GstType
      gst_amount: string
      total_amount: string
      charge_date: string
      payment_terms: PaymentTerms
      due_date: string | null
      notes: string | null
      recorded_by_name: string | null
      created_at: string
      approval_status: ApprovalStatus
      approved_by_name: string | null
      approved_at: string | null
    }>(
      // to_json(...)#>>'{}' gives an ISO-8601 timestamp every browser can parse.
      `select ch.id, ch.kind, ch.service, ch.quantity::text, ch.rate::text, ch.base_amount::text, ch.gst_type,
              ch.gst_amount::text, ch.total_amount::text, ch.charge_date::text, ch.payment_terms,
              ch.due_date::text, ch.notes, e.name as recorded_by_name, to_json(ch.created_at)#>>'{}' as created_at,
              ch.approval_status, a.name as approved_by_name, to_json(ch.approved_at)#>>'{}' as approved_at
       from public.client_charges ch
       left join public.employees e on e.id = ch.recorded_by_employee_id
       left join public.employees a on a.id = ch.approved_by_employee_id
       where ch.client_id = $1`,
      [clientId]
    ),
    pool.query<{
      id: string
      amount: string
      base_amount: string
      gst_type: GstType
      payment_date: string
      method: string | null
      reference: string | null
      status: string
      approval_status: ApprovalStatus
      approved_by_name: string | null
      approved_at: string | null
      charge_id: string | null
      notes: string | null
      recorded_by_name: string | null
      created_at: string
    }>(
      `select p.id, p.amount::text, p.base_amount::text, p.gst_type, p.payment_date::text, p.method, p.reference,
              p.status, p.approval_status, a.name as approved_by_name, to_json(p.approved_at)#>>'{}' as approved_at,
              p.charge_id, p.notes, e.name as recorded_by_name, to_json(p.created_at)#>>'{}' as created_at
       from public.payments p
       left join public.employees e on e.id = p.recorded_by_employee_id
       left join public.employees a on a.id = p.approved_by_employee_id
       where p.client_id = $1`,
      [clientId]
    ),
  ])

  const charges: LedgerEntry[] = chargesResult.rows.map((c) => {
    const isOpeningBalance = c.kind === "Opening balance"
    return {
      id: c.id,
      type: "charge",
      date: c.charge_date,
      createdAt: c.created_at,
      label: isOpeningBalance ? "Opening balance" : c.service,
      isOpeningBalance,
      quantity: isOpeningBalance ? null : Number(c.quantity),
      rate: isOpeningBalance ? null : Number(c.rate),
      reference: null,
      gstType: c.gst_type,
      base: Number(c.base_amount),
      gst: Number(c.gst_amount),
      total: Number(c.total_amount),
      countsTowardBalance: c.approval_status === "Approved",
      approvalStatus: c.approval_status,
      approvedBy: c.approved_by_name,
      approvedAt: c.approved_at,
      chargeId: null,
      paymentTerms: isOpeningBalance ? null : c.payment_terms,
      dueDate: c.due_date,
      notes: c.notes,
      recordedBy: c.recorded_by_name,
    }
  })

  const payments: LedgerEntry[] = paymentsResult.rows
    // Failed/refunded receipts never moved the balance and aren't part of the credit history.
    .filter((p) => p.status === "Received")
    .map((p) => {
      const total = Number(p.amount)
      const base = Number(p.base_amount)
      return {
        id: p.id,
        type: "payment",
        date: p.payment_date,
        createdAt: p.created_at,
        label: p.method ?? "Payment",
        isOpeningBalance: false,
        quantity: null,
        rate: null,
        reference: p.reference,
        gstType: p.gst_type,
        base,
        gst: Math.round((total - base) * 100) / 100,
        total,
        countsTowardBalance: p.approval_status === "Approved",
        approvalStatus: p.approval_status,
        approvedBy: p.approved_by_name,
        approvedAt: p.approved_at,
        chargeId: p.charge_id,
        paymentTerms: null,
        dueDate: null,
        notes: p.notes,
        recordedBy: p.recorded_by_name,
      }
    })

  return [...charges, ...payments]
}

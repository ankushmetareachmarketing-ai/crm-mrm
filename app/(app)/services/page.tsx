import { getCurrentEmployee } from "@/lib/auth/current-user"
import type { ApprovalStatus, GstType, PaymentTerms } from "@/lib/billing"
import { pool } from "@/lib/db"
import { ServicesClient, type BookedService } from "./services-client"

export default async function ServicesPage() {
  const currentEmployee = await getCurrentEmployee()
  const isOwner = currentEmployee.role === "Owner"

  const { rows } = await pool.query<{
    id: string
    client_id: string
    company: string
    owner_name: string | null
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
    paid_now: string
    paid_now_base: string
    recorded_by_name: string | null
    approval_status: ApprovalStatus
    approved_by_name: string | null
  }>(
    `select ch.id, ch.client_id, c.company, o.name as owner_name, ch.service, ch.quantity::text, ch.rate::text,
            ch.base_amount::text, ch.gst_type, ch.gst_amount::text, ch.total_amount::text, ch.charge_date::text,
            ch.payment_terms, ch.due_date::text,
            coalesce(pn.total, 0)::text as paid_now, coalesce(pn.base, 0)::text as paid_now_base,
            e.name as recorded_by_name, ch.approval_status, a.name as approved_by_name
     from public.client_charges ch
     join public.clients c on c.id = ch.client_id
     left join public.employees o on o.id = c.owner_employee_id
     left join public.employees e on e.id = ch.recorded_by_employee_id
     left join public.employees a on a.id = ch.approved_by_employee_id
     left join lateral (
       select sum(amount) as total, sum(base_amount) as base
       from public.payments where charge_id = ch.id and status = 'Received' and approval_status <> 'Rejected'
     ) pn on true
     where ch.kind = 'Service' ${isOwner ? "" : "and c.owner_employee_id = $1"}
     order by (ch.approval_status = 'Pending') desc, ch.charge_date desc, ch.created_at desc
     limit 2000`,
    isOwner ? [] : [currentEmployee.id]
  )

  const services: BookedService[] = rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    company: r.company,
    salesPerson: r.owner_name,
    service: r.service,
    quantity: Number(r.quantity),
    rate: Number(r.rate),
    base: Number(r.base_amount),
    gstType: r.gst_type,
    gst: Number(r.gst_amount),
    total: Number(r.total_amount),
    date: r.charge_date,
    paymentTerms: r.payment_terms,
    dueDate: r.due_date,
    paidNow: Number(r.paid_now),
    paidNowBase: Number(r.paid_now_base),
    recordedBy: r.recorded_by_name,
    approvalStatus: r.approval_status,
    approvedBy: r.approved_by_name,
  }))

  return <ServicesClient services={services} isOwner={isOwner} />
}

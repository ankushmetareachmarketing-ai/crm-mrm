import { pool } from "@/lib/db"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import type { Payment } from "@/lib/types"
import { SalesReportClient } from "./sales-report-client"

interface PaymentRow {
  id: string
  client_id: string
  company: string
  amount: string
  payment_date: string
  method: string | null
  reference: string | null
  status: Payment["status"]
  notes: string | null
  recorded_by_name: string | null
  created_at: string
  approval_status: Payment["approvalStatus"]
  approved_by_name: string | null
  approved_at: string | null
}

export default async function SalesReportPage() {
  const currentEmployee = await getCurrentEmployee()
  const canSeeAll = currentEmployee.role === "Owner"
  const scopeClause = canSeeAll ? "" : "and c.owner_employee_id = $1"
  const scopeParams = canSeeAll ? [] : [currentEmployee.id]

  const { rows } = await pool.query<PaymentRow>(
    `select p.id, p.client_id, c.company, p.amount::text, p.payment_date::text, p.method, p.reference,
            p.status, p.notes, e.name as recorded_by_name, p.created_at::text,
            p.approval_status, a.name as approved_by_name, p.approved_at::text
     from public.payments p
     join public.clients c on c.id = p.client_id
     left join public.employees e on e.id = p.recorded_by_employee_id
     left join public.employees a on a.id = p.approved_by_employee_id
     where 1 = 1 ${scopeClause}
     order by p.payment_date desc, p.created_at desc
     limit 2000`,
    scopeParams
  )

  const payments: Payment[] = rows.map((p) => ({
    id: p.id,
    clientId: p.client_id,
    clientCompany: p.company,
    amount: Number(p.amount),
    paymentDate: p.payment_date,
    method: p.method,
    reference: p.reference,
    status: p.status,
    notes: p.notes,
    recordedBy: p.recorded_by_name,
    createdAt: p.created_at,
    approvalStatus: p.approval_status,
    approvedBy: p.approved_by_name,
    approvedAt: p.approved_at,
  }))

  return <SalesReportClient payments={payments} canSeeAll={canSeeAll} />
}

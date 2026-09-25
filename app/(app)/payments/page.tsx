import { pool } from "@/lib/db"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import type { Payment, PaymentReminder } from "@/lib/types"
import { PaymentsClient } from "./payments-client"

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

interface ReminderRow {
  id: string
  client_id: string
  company: string
  due_date: string
  expected_amount: string | null
  status: PaymentReminder["status"]
  notes: string | null
  created_at: string
}

export default async function PaymentsPage() {
  const currentEmployee = await getCurrentEmployee()
  const isOwner = currentEmployee.role === "Owner"
  const canSeeAll = isOwner || currentEmployee.role === "HR"
  const canApprove = isOwner
  const scopeClause = canSeeAll ? "" : "and c.owner_employee_id = $1"
  const scopeParams = canSeeAll ? [] : [currentEmployee.id]

  const [paymentsResult, remindersResult, clientsResult] = await Promise.all([
    pool.query<PaymentRow>(
      `select p.id, p.client_id, c.company, p.amount::text, p.payment_date::text, p.method, p.reference,
              p.status, p.notes, e.name as recorded_by_name, p.created_at::text,
              p.approval_status, a.name as approved_by_name, p.approved_at::text
       from public.payments p
       join public.clients c on c.id = p.client_id
       left join public.employees e on e.id = p.recorded_by_employee_id
       left join public.employees a on a.id = p.approved_by_employee_id
       where 1 = 1 ${scopeClause}
       order by p.payment_date desc, p.created_at desc
       limit 50`,
      scopeParams
    ),
    pool.query<ReminderRow>(
      `select r.id, r.client_id, c.company, r.due_date::text, r.expected_amount::text, r.status, r.notes,
              r.created_at::text
       from public.payment_reminders r
       join public.clients c on c.id = r.client_id
       where r.status in ('Pending', 'Overdue') ${scopeClause}
       order by r.due_date
       limit 50`,
      scopeParams
    ),
    pool.query<{ id: string; company: string }>(
      `select id, company from public.clients c where 1 = 1 ${scopeClause} order by company`,
      scopeParams
    ),
  ])

  const payments: Payment[] = paymentsResult.rows.map((p) => ({
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

  const reminders: PaymentReminder[] = remindersResult.rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    clientCompany: r.company,
    dueDate: r.due_date,
    expectedAmount: r.expected_amount ? Number(r.expected_amount) : null,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
  }))

  return (
    <PaymentsClient
      initialPayments={payments}
      initialReminders={reminders}
      clients={clientsResult.rows}
      canApprove={canApprove}
    />
  )
}

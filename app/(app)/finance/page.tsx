import { notFound } from "next/navigation"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import { Wallet, ReceiptText, TrendingUp, ShieldAlert } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { formatCurrency } from "@/lib/format"
import { pool } from "@/lib/db"
import { FinanceTables } from "./finance-tables"

export default async function FinancePage() {
  // Company-wide balances: HR only (Owner uses Sales Details).
  const currentEmployee = await getCurrentEmployee()
  if (currentEmployee.role !== "HR") notFound()

  const [clientsResult, pendingResult, verifiedResult] = await Promise.all([
    pool.query<{ id: string; company: string; balance: string; last_receipt_date: string | null }>(
      `select id, company, balance::text, last_receipt_date::text from public.clients order by company`
    ),
    pool.query<{ id: string; client_id: string; company: string; amount: string; payment_date: string }>(
      `select p.id, p.client_id, c.company, p.amount::text, p.payment_date::text
       from public.payments p
       join public.clients c on c.id = p.client_id
       where p.approval_status = 'Pending'
       order by p.payment_date desc`
    ),
    pool.query<{ total: string }>(
      `select coalesce(sum(amount), 0)::text as total
       from public.payments
       where approval_status = 'Approved' and date_trunc('month', payment_date) = date_trunc('month', current_date)`
    ),
  ])

  const clients = clientsResult.rows.map((c) => ({
    id: c.id,
    company: c.company,
    balance: Number(c.balance),
    lastReceiptDate: c.last_receipt_date,
  }))

  const totalDue = clients.reduce((sum, c) => sum + Math.max(c.balance, 0), 0)
  const totalAdvance = clients.reduce((sum, c) => sum + Math.max(-c.balance, 0), 0)
  const pendingReceipts = pendingResult.rows.map((p) => ({
    id: p.id,
    clientId: p.client_id,
    company: p.company,
    amount: Number(p.amount),
  }))
  const verifiedThisMonth = Number(verifiedResult.rows[0].total)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Client Finance"
        description="One master ledger per client. Only Owner acceptance posts a receipt."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Verified collections" value={formatCurrency(verifiedThisMonth)} icon={Wallet} />
        <StatCard label="Total outstanding due" value={formatCurrency(totalDue)} icon={ReceiptText} />
        <StatCard label="Total advances held" value={formatCurrency(totalAdvance)} icon={TrendingUp} />
        <StatCard
          label="Unverified submissions"
          value={String(pendingReceipts.length)}
          icon={ShieldAlert}
          hint="Awaiting owner acceptance"
        />
      </div>

      <FinanceTables clients={clients} pendingReceipts={pendingReceipts} />
    </div>
  )
}

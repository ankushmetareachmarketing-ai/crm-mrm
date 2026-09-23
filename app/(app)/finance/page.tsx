import Link from "next/link"
import { Wallet, ReceiptText, TrendingUp, ShieldAlert } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency, formatDate } from "@/lib/format"
import { pool } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function FinancePage() {
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Client due / advance aging</CardTitle>
            <CardDescription>Due = max(balance, 0). Advance = max(-balance, 0).</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead className="text-right">Advance</TableHead>
                  <TableHead>Last receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/crm/clients/${c.id}`} className="font-medium hover:underline">
                        {c.company}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      {c.balance > 0 ? formatCurrency(c.balance) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-emerald-700">
                      {c.balance < 0 ? formatCurrency(-c.balance) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(c.lastReceiptDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending payment submissions</CardTitle>
            <CardDescription>Does not change confirmed due until accepted.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {pendingReceipts.map((p) => (
              <Link key={p.id} href={`/crm/clients/${p.clientId}`} className="block rounded-lg border p-3 hover:border-primary">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{p.company}</span>
                  <StatusBadge status="Pending" />
                </div>
                <p className="mt-1 text-sm font-medium">{formatCurrency(p.amount)}</p>
              </Link>
            ))}
            {pendingReceipts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submissions awaiting acceptance.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

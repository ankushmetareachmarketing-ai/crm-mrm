import Link from "next/link"
import { CalendarClock, Megaphone, ReceiptText, TrendingUp, Wallet } from "@/components/icons"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { ApprovalActions } from "@/components/approval-actions"
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/format"
import { pool } from "@/lib/db"
import { getClientLedgerSummaries } from "@/lib/data/client-ledger"
import { cn } from "@/lib/utils"

export async function OwnerDashboard() {
  const [summaries, monthTotalsResult, inboxResult, remindersResult, activityResult] = await Promise.all([
    getClientLedgerSummaries(null),
    pool.query<{ billed: string; billed_gst: string; received: string }>(
      `select
         (select coalesce(sum(total_amount), 0) from public.client_charges
          where kind = 'Service' and approval_status = 'Approved'
            and date_trunc('month', charge_date) = date_trunc('month', current_date))::text as billed,
         (select coalesce(sum(gst_amount), 0) from public.client_charges
          where kind = 'Service' and approval_status = 'Approved'
            and date_trunc('month', charge_date) = date_trunc('month', current_date))::text as billed_gst,
         (select coalesce(sum(amount), 0) from public.payments
          where status = 'Received' and approval_status = 'Approved'
            and date_trunc('month', payment_date) = date_trunc('month', current_date))::text as received`
    ),
    // Services and standalone payments waiting on the Owner. A payment taken
    // while booking a service is approved together with that service.
    pool.query<{
      kind: "service" | "payment"
      id: string
      client_id: string
      company: string
      detail: string
      amount: string
      submitted_by: string | null
      entry_date: string
    }>(
      `select 'service' as kind, ch.id::text as id, ch.client_id, c.company,
              ch.service || ' · ' || ch.payment_terms as detail, ch.total_amount::text as amount,
              e.name as submitted_by, ch.charge_date::text as entry_date, ch.created_at
       from public.client_charges ch
       join public.clients c on c.id = ch.client_id
       left join public.employees e on e.id = ch.recorded_by_employee_id
       where ch.approval_status = 'Pending'
       union all
       select 'payment', p.id, p.client_id, c.company,
              coalesce(p.method, 'Payment') || coalesce(' · ' || p.reference, ''), p.amount::text,
              e.name, p.payment_date::text, p.created_at
       from public.payments p
       join public.clients c on c.id = p.client_id
       left join public.employees e on e.id = p.recorded_by_employee_id
       where p.approval_status = 'Pending' and p.charge_id is null
       order by created_at desc
       limit 20`
    ),
    pool.query<{
      id: string
      client_id: string
      company: string
      due_date: string
      expected_amount: string | null
      sales_person: string | null
    }>(
      `select r.id, r.client_id, c.company, r.due_date::text, r.expected_amount::text, e.name as sales_person
       from public.payment_reminders r
       join public.clients c on c.id = r.client_id
       left join public.employees e on e.id = c.owner_employee_id
       where r.status in ('Pending', 'Overdue')
       order by r.due_date
       limit 8`
    ),
    pool.query<{
      id: string
      entity_type: "lead" | "client"
      entity_id: string
      action: string
      detail: string | null
      actor_name: string | null
      created_at: string
    }>(
      `select a.id, a.entity_type, a.entity_id, a.action, a.detail, e.name as actor_name,
              to_json(a.created_at)#>>'{}' as created_at
       from public.activity_log a
       left join public.employees e on e.id = a.actor_employee_id
       order by a.created_at desc
       limit 10`
    ),
  ])

  const inbox = inboxResult.rows
  const reminders = remindersResult.rows
  const activity = activityResult.rows
  const monthTotals = monthTotalsResult.rows[0]
  const verifiedCollections = Number(monthTotals.received)
  const billedThisMonth = Number(monthTotals.billed)
  const outstandingDues = summaries.reduce((sum, s) => sum + Math.max(s.dueTotal, 0), 0)
  const clientsWithDues = summaries.filter((s) => s.dueTotal > 0).length
  const clientAdvances = summaries.reduce((sum, s) => sum + Math.max(-s.dueTotal, 0), 0)
  const todayKey = new Date().toISOString().slice(0, 10)

  const teamByPerson = new Map<string, { name: string; clients: number; received: number; due: number }>()
  for (const s of summaries) {
    const key = s.ownerEmployeeId ?? "unassigned"
    const entry = teamByPerson.get(key) ?? { name: s.ownerName ?? "Unassigned", clients: 0, received: 0, due: 0 }
    entry.clients += 1
    entry.received += s.receivedTotal
    entry.due += s.dueTotal
    teamByPerson.set(key, entry)
  }
  const team = Array.from(teamByPerson.values()).sort((a, b) => b.due - a.due)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Owner Dashboard"
        description="Approvals, collections and dues across your sales team. Amounts include GST."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Collected this month"
          value={formatCurrency(verifiedCollections)}
          icon={Wallet}
          hint="Approved payments"
          href="/sales-details"
        />
        <StatCard
          label="Still to collect"
          value={formatCurrency(outstandingDues)}
          icon={ReceiptText}
          hint={`${clientsWithDues} ${clientsWithDues === 1 ? "client owes" : "clients owe"} money`}
          href="/sales-details"
        />
        <StatCard
          label="Billed this month"
          value={formatCurrency(billedThisMonth)}
          icon={Megaphone}
          hint={`incl. GST ${formatCurrency(Number(monthTotals.billed_gst))}`}
          href="/services"
        />
        <StatCard
          label="Extra paid by clients"
          value={formatCurrency(clientAdvances)}
          icon={TrendingUp}
          hint="Paid more than billed"
          href="/sales-details"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Waiting for your approval
              {inbox.length > 0 ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {inbox.length}
                </span>
              ) : null}
            </CardTitle>
            <CardDescription>
              Services and payments added by Sales. They count in the client&apos;s bill only after you approve.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Added by</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inbox.map((item) => (
                  <TableRow key={`${item.kind}-${item.id}`}>
                    <TableCell>
                      <StatusBadge status={item.kind === "service" ? "Service" : "Payment"} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/sales-details/${item.client_id}`} className="font-medium hover:underline">
                        {item.company}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.detail}
                      <div className="text-xs">{formatDate(item.entry_date)}</div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(item.amount))}</TableCell>
                    <TableCell className="text-muted-foreground">{item.submitted_by ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <ApprovalActions kind={item.kind} id={item.id} />
                    </TableCell>
                  </TableRow>
                ))}
                {inbox.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Nothing is waiting for your approval.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments due soon</CardTitle>
            <CardDescription>Dates clients promised to pay by. Late ones first.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {reminders.map((r) => {
              const late = r.due_date < todayKey
              return (
                <Link
                  key={r.id}
                  href={`/sales-details/${r.client_id}`}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50",
                    late && "border-rose-200 bg-rose-50/50"
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.company}</p>
                    <p className="text-xs text-muted-foreground">{r.sales_person ?? "Not assigned"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {r.expected_amount ? (
                      <p className="text-sm font-semibold">{formatCurrency(Number(r.expected_amount))}</p>
                    ) : null}
                    <p
                      className={cn(
                        "flex items-center justify-end gap-1 text-xs",
                        late ? "font-semibold text-rose-700" : "text-muted-foreground"
                      )}
                    >
                      <CalendarClock className="size-3.5" />
                      {late ? `Late · ${formatDate(r.due_date)}` : formatDate(r.due_date)}
                    </p>
                  </div>
                </Link>
              )
            })}
            {reminders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No payments are due.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Sales team</CardTitle>
              <CardDescription>Money collected and still to collect for each sales person&apos;s clients.</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              nativeButton={false}
              render={<Link href="/sales-details" />}
            >
              Open sales details
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sales person</TableHead>
                  <TableHead className="text-right">Clients</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Still to collect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((t) => (
                  <TableRow key={t.name}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-right">{t.clients}</TableCell>
                    <TableCell className="text-right text-emerald-700">{formatCurrency(t.received)}</TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      {formatCurrency(Math.max(t.due, 0))}
                    </TableCell>
                  </TableRow>
                ))}
                {team.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      No clients yet.{" "}
                      <Link href="/crm/clients" className="font-medium text-foreground underline">
                        Add a client
                      </Link>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>The latest changes across all leads and clients.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {activity.map((a) => (
              <Link
                key={a.id}
                href={a.entity_type === "client" ? `/sales-details/${a.entity_id}` : "/crm/leads"}
                className="flex gap-3 rounded-lg p-1 transition-colors hover:bg-accent/50"
              >
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {a.action}
                    {a.actor_name ? <span className="font-normal text-muted-foreground"> · {a.actor_name}</span> : null}
                  </span>
                  {a.detail ? <span className="block truncate text-xs text-muted-foreground">{a.detail}</span> : null}
                  <span className="block text-[11px] text-muted-foreground">{formatRelativeTime(a.created_at)}</span>
                </span>
              </Link>
            ))}
            {activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

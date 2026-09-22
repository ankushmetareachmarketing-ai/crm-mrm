import Link from "next/link"
import { CalendarClock, IndianRupee, Phone, Building2, PhoneCall, ThumbsDown, ThumbsUp } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/format"
import { pool } from "@/lib/db"
import { ActivityComposer } from "./activity-composer"

export async function SalesDashboard({ employeeId }: { employeeId: string }) {
  const [
    dueClientsResult,
    remindersResult,
    callsTodayResult,
    followUpsResult,
    activityResult,
    myLeadsResult,
    myClientsResult,
  ] = await Promise.all([
    pool.query<{ id: string; company: string; balance: string; last_receipt_date: string | null }>(
      `select id, company, balance::text, last_receipt_date::text
       from public.clients
       where owner_employee_id = $1 and balance > 0
       order by balance desc
       limit 6`,
      [employeeId]
    ),
    pool.query<{ id: string; company: string; due_date: string; expected_amount: string | null }>(
      `select r.id, c.company, r.due_date::text, r.expected_amount::text
       from public.payment_reminders r
       join public.clients c on c.id = r.client_id
       where c.owner_employee_id = $1 and r.status in ('Pending', 'Overdue')
       order by r.due_date
       limit 6`,
      [employeeId]
    ),
    pool.query<{ outcome: string; count: string }>(
      `select outcome, count(*)::text as count
       from public.call_logs
       where employee_id = $1 and called_at::date = current_date
       group by outcome`,
      [employeeId]
    ),
    pool.query<{ id: string; name: string | null; phone: string; next_follow_up_date: string; next_follow_up_time: string | null }>(
      `select id, name, phone, next_follow_up_date::text, next_follow_up_time::text
       from public.call_list_entries
       where owner_employee_id = $1 and next_follow_up_date is not null and next_follow_up_date <= current_date
       order by next_follow_up_date asc, next_follow_up_time asc nulls last`,
      [employeeId]
    ),
    pool.query<{ id: string; action: string; detail: string | null; entity_type: string; entity_id: string; created_at: string }>(
      `select id, action, detail, entity_type, entity_id, created_at::text
       from public.activity_log
       where actor_employee_id = $1
       order by created_at desc
       limit 8`,
      [employeeId]
    ),
    pool.query<{ id: string; company: string }>(
      `select id, company from public.leads where owner_employee_id = $1 order by created_at desc`,
      [employeeId]
    ),
    pool.query<{ id: string; company: string }>(
      `select id, company from public.clients where owner_employee_id = $1 order by created_at desc`,
      [employeeId]
    ),
  ])

  const totalDue = dueClientsResult.rows.reduce((sum, c) => sum + Number(c.balance), 0)
  const callsToday = callsTodayResult.rows.reduce((sum, r) => sum + Number(r.count), 0)
  const interestedToday = callsTodayResult.rows.find((r) => r.outcome === "Interested")?.count ?? "0"
  const notInterestedToday = callsTodayResult.rows.find((r) => r.outcome === "Not Interested")?.count ?? "0"
  const todayKey = new Date().toISOString().slice(0, 10)

  const records = [
    ...myLeadsResult.rows.map((l) => ({ entityType: "lead" as const, entityId: l.id, label: `${l.company} (Lead)` })),
    ...myClientsResult.rows.map((c) => ({ entityType: "client" as const, entityId: c.id, label: `${c.company} (Client)` })),
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Dashboard"
        description="Your leads, clients, dues and calls — nobody else's data shows up here."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My clients" value={String(myClientsResult.rows.length)} icon={Building2} href="/crm/clients" />
        <StatCard
          label="Payments due"
          value={formatCurrency(totalDue)}
          icon={IndianRupee}
          hint={`${dueClientsResult.rows.length} clients`}
          href="/payments"
        />
        <StatCard
          label="Calls today"
          value={String(callsToday)}
          icon={Phone}
          hint={`${interestedToday} interested · ${notInterestedToday} not interested`}
          href="/calls"
        />
        <StatCard
          label="Follow-ups due"
          value={String(followUpsResult.rows.length)}
          icon={CalendarClock}
          hint={followUpsResult.rows.filter((f) => f.next_follow_up_date < todayKey).length > 0 ? "some overdue" : undefined}
          href="/calls"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Payments due</CardTitle>
              <CardDescription>Your clients with an outstanding balance.</CardDescription>
            </div>
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/payments" />}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {dueClientsResult.rows.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Link href={`/crm/clients/${c.id}`} className="text-sm font-medium hover:underline">
                    {c.company}
                  </Link>
                  <p className="text-xs text-muted-foreground">Last receipt {formatDate(c.last_receipt_date)}</p>
                </div>
                <span className="text-sm font-medium text-destructive">{formatCurrency(Number(c.balance))}</span>
              </div>
            ))}
            {dueClientsResult.rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No dues pending. Nice.</p>
            ) : null}
            {remindersResult.rows.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">Upcoming reminders</p>
                {remindersResult.rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span>{r.company}</span>
                    <span className="text-muted-foreground">
                      {formatDate(r.due_date)}
                      {r.expected_amount ? ` · ${formatCurrency(Number(r.expected_amount))}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Today&apos;s calls</CardTitle>
              <CardDescription>Outcomes logged today from your call list.</CardDescription>
            </div>
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/calls" />}>
              Go to calls
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border p-3">
                <PhoneCall className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-1 text-lg font-semibold">{callsToday}</p>
                <p className="text-xs text-muted-foreground">Total calls</p>
              </div>
              <div className="rounded-lg border p-3">
                <ThumbsUp className="mx-auto size-5 text-emerald-600" />
                <p className="mt-1 text-lg font-semibold">{interestedToday}</p>
                <p className="text-xs text-muted-foreground">Interested</p>
              </div>
              <div className="rounded-lg border p-3">
                <ThumbsDown className="mx-auto size-5 text-destructive" />
                <p className="mt-1 text-lg font-semibold">{notInterestedToday}</p>
                <p className="text-xs text-muted-foreground">Not interested</p>
              </div>
            </div>
            {followUpsResult.rows.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">Follow-ups due</p>
                {followUpsResult.rows.slice(0, 5).map((f) => (
                  <div key={f.id} className="flex items-center justify-between text-sm">
                    <span>{f.name ?? f.phone}</span>
                    <span
                      className={
                        f.next_follow_up_date < todayKey ? "font-medium text-destructive" : "text-muted-foreground"
                      }
                    >
                      {f.next_follow_up_date < todayKey ? "Overdue" : formatDate(f.next_follow_up_date)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick log</CardTitle>
            <CardDescription>Log an update against one of your leads or clients.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityComposer records={records} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My recent activity</CardTitle>
            <CardDescription>Across all your leads and clients.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {activityResult.rows.map((a) => (
              <div key={a.id} className="flex gap-3 border-b pb-3 last:border-0">
                <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p className="text-sm font-medium">{a.action}</p>
                  {a.detail ? <p className="text-sm text-muted-foreground">{a.detail}</p> : null}
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(a.created_at)}</p>
                </div>
              </div>
            ))}
            {activityResult.rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No activity logged yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

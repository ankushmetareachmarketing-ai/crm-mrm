import Link from "next/link"
import { CalendarCheck, IndianRupee, KeyRound, UserCheck, Users2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"
import { pool } from "@/lib/db"

export async function HrDashboard() {
  const [
    headcountResult,
    todayAttendanceResult,
    pendingPaymentsResult,
    recentCredentialActivityResult,
  ] = await Promise.all([
    pool.query<{ total: string; active: string }>(
      `select count(*)::text as total, count(*) filter (where active)::text as active from public.employees`
    ),
    pool.query<{ checked_in: string; checked_out: string }>(
      `select count(*) filter (where check_in_at is not null)::text as checked_in,
              count(*) filter (where check_out_at is not null)::text as checked_out
       from public.attendance_entries where work_date = current_date`
    ),
    pool.query<{ id: string; amount: string; company: string; recorded_by_name: string | null }>(
      `select p.id, p.amount::text, c.company, e.name as recorded_by_name
       from public.payments p
       join public.clients c on c.id = p.client_id
       left join public.employees e on e.id = p.recorded_by_employee_id
       where p.approval_status = 'Pending'
       order by p.created_at desc
       limit 6`
    ),
    pool.query<{ id: string; label: string; action: string; changed_at: string; employee_name: string; changed_by_name: string | null }>(
      `select h.id, h.label, h.action, h.changed_at::text, emp.name as employee_name, u.name as changed_by_name
       from public.employee_credential_history h
       join public.employees emp on emp.id = h.employee_id
       left join public.employees u on u.id = h.changed_by_employee_id
       order by h.changed_at desc
       limit 6`
    ),
  ])

  const headcount = headcountResult.rows[0]
  const todayAttendance = todayAttendanceResult.rows[0]
  const pendingPayments = pendingPaymentsResult.rows
  const pendingTotal = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  const recentCredentialActivity = recentCredentialActivityResult.rows

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="HR Dashboard"
        description="Employees, attendance and payment approvals at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Employees" value={headcount.total} icon={Users2} hint={`${headcount.active} active`} href="/hr/employees" />
        <StatCard label="Checked in today" value={todayAttendance.checked_in} icon={UserCheck} href="/hr/attendance" />
        <StatCard
          label="Payments awaiting approval"
          value={String(pendingPayments.length)}
          icon={IndianRupee}
          hint={pendingPayments.length > 0 ? formatCurrency(pendingTotal) : undefined}
          href="/payments"
        />
        <StatCard label="Credential changes (recent)" value={String(recentCredentialActivity.length)} icon={KeyRound} href="/hr/employees" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Payments awaiting approval</CardTitle>
              <CardDescription>Recorded by Sales, waiting on HR sign-off.</CardDescription>
            </div>
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/payments" />}>
              Review
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {pendingPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{p.company}</p>
                  <p className="text-xs text-muted-foreground">Recorded by {p.recorded_by_name ?? "—"}</p>
                </div>
                <span className="text-sm font-medium">{formatCurrency(Number(p.amount))}</span>
              </div>
            ))}
            {pendingPayments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing waiting on you. Nice.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Attendance today</CardTitle>
              <CardDescription>Company-wide check-in progress.</CardDescription>
            </div>
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/hr/attendance" />}>
              Open
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg border p-3">
                <CalendarCheck className="mx-auto size-5 text-emerald-600" />
                <p className="mt-1 text-lg font-semibold">{todayAttendance.checked_in}</p>
                <p className="text-xs text-muted-foreground">Checked in</p>
              </div>
              <div className="rounded-lg border p-3">
                <CalendarCheck className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-1 text-lg font-semibold">{todayAttendance.checked_out}</p>
                <p className="text-xs text-muted-foreground">Checked out</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent credential changes</CardTitle>
          <CardDescription>Across every employee&apos;s vault.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {recentCredentialActivity.map((h) => (
            <div key={h.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0">
              <span>
                {h.employee_name} — {h.label}
              </span>
              <span className="flex items-center gap-2 text-muted-foreground">
                <StatusBadge status={h.action} />
                {h.changed_by_name ?? "—"}
              </span>
            </div>
          ))}
          {recentCredentialActivity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No credential changes yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

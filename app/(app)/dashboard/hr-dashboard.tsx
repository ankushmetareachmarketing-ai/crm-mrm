import Link from "next/link"
import {
  AlarmClock,
  BookOpen,
  Building2,
  Cake,
  CalendarRange,
  Hierarchy,
  Laptop,
  ListChecks,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
} from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { CheckInCard } from "@/components/hr/check-in-card"
import { EmployeeAvatar } from "@/components/hr/employee-bits"
import { LeaveRequestsCard } from "@/components/hr/leave-parts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { getAttendanceRows, getEmployeeDirectory, getLeaveRequests } from "@/lib/data/hr"
import { getTodayAttendance } from "@/lib/data/me"
import { attendanceMetrics, isWorkingDay } from "@/lib/hr/attendance"
import { getHrSettings } from "@/lib/hr/server"
import { formatOfficeTime, officeDateKey } from "@/lib/hr/time"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

const WORKING = ["Onboarding", "Probation", "Active", "Notice Period"]

export async function HrDashboard() {
  const me = await getCurrentEmployee()
  const today = officeDateKey()
  const [employees, settings, todayRows, leave, myToday, onboardingProgress, extras] = await Promise.all([
    getEmployeeDirectory(),
    getHrSettings(),
    getAttendanceRows(today, today),
    getLeaveRequests(),
    getTodayAttendance(me.id),
    pool.query<{ employee_id: string; total: number; done: number }>(
      `select employee_id, count(*)::int as total, count(done_at)::int as done
       from public.employee_onboarding_tasks group by employee_id`
    ),
    pool.query<{ id: string; name: string; photo_url: string | null; date_of_birth: string | null; joining_date: string }>(
      `select id, name, photo_url, date_of_birth::text, joining_date::text
       from public.employees
       where active and (extract(month from date_of_birth) = extract(month from current_date)
                         or (extract(month from joining_date) = extract(month from current_date)
                             and extract(year from joining_date) < extract(year from current_date)))`
    ),
  ])

  const working = employees.filter((e) => WORKING.includes(e.status))
  const rowsBy = new Map(todayRows.map((r) => [r.employeeId, r]))
  const present = working.filter((e) => {
    const r = rowsBy.get(e.id)
    return r && (r.status === "Present" || r.status === "Half Day")
  })
  const late = present.filter((e) => attendanceMetrics(rowsBy.get(e.id)!, settings).isLate)
  const onLeave = working.filter((e) => rowsBy.get(e.id)?.status === "On Leave")
  const notIn = working.filter((e) => !rowsBy.get(e.id) || rowsBy.get(e.id)!.status === "Absent")
  const pendingLeave = leave.filter((r) => r.status === "Pending")
  const onboarding = working.filter((e) => e.status === "Onboarding")
  const progress = Object.fromEntries(onboardingProgress.rows.map((r) => [r.employee_id, r]))
  const workingDay = isWorkingDay(today, settings)

  const month = today.slice(5, 7)
  const birthdays = extras.rows.filter((e) => e.date_of_birth?.slice(5, 7) === month).sort((a, b) => a.date_of_birth!.slice(8).localeCompare(b.date_of_birth!.slice(8)))
  const anniversaries = extras.rows
    .filter((e) => e.joining_date.slice(5, 7) === month && e.joining_date.slice(0, 4) < today.slice(0, 4))
    .sort((a, b) => a.joining_date.slice(8).localeCompare(b.joining_date.slice(8)))

  const deptCounts = new Map<string, number>()
  for (const e of working) deptCounts.set(e.department ?? "No department", (deptCounts.get(e.department ?? "No department") ?? 0) + 1)
  const maxDept = Math.max(1, ...deptCounts.values())

  const links = [
    { href: "/hr/employees", label: "Employees", icon: Users },
    { href: "/hr/organization", label: "Organization", icon: Hierarchy },
    { href: "/hr/attendance-report", label: "Attendance", icon: CalendarRange },
    { href: "/hr/leave", label: "Leave", icon: ListChecks },
    { href: "/hr/onboarding", label: "Onboarding & policies", icon: BookOpen },
    { href: "/hr/assets", label: "Assets", icon: Laptop },
    { href: "/hr/roles", label: "Roles & permissions", icon: ShieldAlert },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="HR Dashboard"
        description="People, attendance, leave and onboarding at a glance."
        actions={
          <Button className="cursor-pointer" nativeButton={false} render={<Link href="/hr/employees/new" />}>
            <UserPlus /> Add employee
          </Button>
        }
      />

      <CheckInCard today={myToday} settings={settings} employeeId={me.id} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Employees" value={String(working.length)} icon={Users} hint={`${employees.length - working.length} left / inactive`} href="/hr/employees" />
        <StatCard label="Present today" value={`${present.length}`} icon={UserCheck} hint={workingDay ? `of ${working.length}` : "Weekly off"} href="/hr/attendance-report" />
        <StatCard label="Late today" value={String(late.length)} icon={AlarmClock} href="/hr/attendance-report" />
        <StatCard label="On leave today" value={String(onLeave.length)} icon={CalendarRange} href="/hr/leave" />
        <StatCard label="Leave to approve" value={String(pendingLeave.length)} icon={ListChecks} href="/hr/leave" />
        <StatCard label="Onboarding" value={String(onboarding.length)} icon={UserPlus} href="/hr/onboarding" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LeaveRequestsCard
            requests={pendingLeave.slice(0, 6)}
            mode="decide"
            showEmployee
            title="Leave waiting for approval"
            description={pendingLeave.length > 6 ? `Showing 6 of ${pendingLeave.length} — see all on the Leave page.` : undefined}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today</CardTitle>
            <CardDescription>{workingDay ? `Office starts at ${settings.officeStart}` : "Weekly off"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div>
              <p className="mb-1 text-xs font-bold tracking-wider text-rose-700 uppercase">Late ({late.length})</p>
              {late.map((e) => (
                <Link key={e.id} href={`/hr/employees/${e.id}`} className="flex items-center justify-between rounded-md px-1 py-1 text-sm hover:bg-accent">
                  <span>{e.name}</span>
                  <span className="text-xs text-muted-foreground">{formatOfficeTime(rowsBy.get(e.id)!.checkInAt)}</span>
                </Link>
              ))}
              {late.length === 0 ? <p className="text-sm text-muted-foreground">Nobody.</p> : null}
            </div>
            <div>
              <p className="mb-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">Not checked in ({notIn.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {notIn.map((e) => (
                  <Link key={e.id} href={`/hr/employees/${e.id}`} className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-accent">
                    {e.name}
                  </Link>
                ))}
                {notIn.length === 0 ? <p className="text-sm text-muted-foreground">Everyone is in.</p> : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Onboarding</CardTitle>
            <CardDescription>New joiners and how far along they are.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {onboarding.map((e) => {
              const p = progress[e.id] ?? { total: 0, done: 0 }
              const pct = p.total ? Math.round((p.done / p.total) * 100) : 0
              return (
                <Link key={e.id} href={`/hr/employees/${e.id}`} className="flex flex-col gap-1.5 rounded-lg border p-2.5 hover:bg-accent/50">
                  <span className="flex items-center justify-between text-sm font-medium">
                    {e.name}
                    <span className="text-xs text-muted-foreground">
                      {p.done}/{p.total}
                    </span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className={cn("block h-full rounded-full", pct === 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${pct}%` }} />
                  </span>
                </Link>
              )
            })}
            {onboarding.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Nobody joining right now.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cake className="size-4 text-primary" /> This month
            </CardTitle>
            <CardDescription>Birthdays and work anniversaries.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {birthdays.map((e) => (
              <Link key={`b-${e.id}`} href={`/hr/employees/${e.id}`} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent">
                <EmployeeAvatar name={e.name} photoUrl={e.photo_url} className="size-7" />
                <span className="flex-1 text-sm">{e.name}</span>
                <span className="text-xs text-muted-foreground">🎂 {formatDate(`${today.slice(0, 4)}${e.date_of_birth!.slice(4)}`).slice(0, 6)}</span>
              </Link>
            ))}
            {anniversaries.map((e) => (
              <Link key={`a-${e.id}`} href={`/hr/employees/${e.id}`} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent">
                <EmployeeAvatar name={e.name} photoUrl={e.photo_url} className="size-7" />
                <span className="flex-1 text-sm">{e.name}</span>
                <span className="text-xs text-muted-foreground">
                  {Number(today.slice(0, 4)) - Number(e.joining_date.slice(0, 4))} yr · {formatDate(`${today.slice(0, 4)}${e.joining_date.slice(4)}`).slice(0, 6)}
                </span>
              </Link>
            ))}
            {birthdays.length + anniversaries.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Nothing this month.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4 text-primary" /> People by department
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {[...deptCounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([name, n]) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="w-32 truncate text-sm">{name}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(n / maxDept) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right text-sm font-semibold">{n}</span>
                </div>
              ))}
            <Link href="/hr/organization" className="mt-1 text-xs font-medium text-primary hover:underline">
              Manage departments →
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-colors hover:bg-accent/50">
            <l.icon className="size-6 text-primary" />
            <span className="text-sm font-medium">{l.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

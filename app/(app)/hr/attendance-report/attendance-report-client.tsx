"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlarmClock, CalendarRange, Clock, Download, LogOut, Settings2, TrendingUp, UserCheck, Users } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { EmployeeAvatar } from "@/components/hr/employee-bits"
import { Field } from "@/components/hr/form-bits"
import {
  attendanceMetrics,
  isWorkingDay,
  summarizeAttendance,
  type HrSettings,
} from "@/lib/hr/attendance"
import { WEEKDAYS } from "@/lib/hr/constants"
import { datesBetween, formatMinutes, formatOfficeTime } from "@/lib/hr/time"
import type { AttendanceRow, EmployeeSummary, NamedOption } from "@/lib/hr/types"
import { downloadCsv } from "@/lib/export-csv"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const ALL = "all"

function monthLabel(key: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(`${key}-01T00:00:00`))
}

function SettingsDialog({ settings }: { settings: HrSettings }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(settings)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/hr/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Could not save.")
        return
      }
      setOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button variant="outline" className="cursor-pointer" onClick={() => { setForm(settings); setError(null); setOpen(true) }}>
        <Settings2 /> Office hours
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Office hours &amp; rules</DialogTitle>
            <DialogDescription>Used to work out late arrival, early leaving, overtime and working days.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Office starts" htmlFor="st-start">
              <Input id="st-start" type="time" className="h-10" value={form.officeStart} onChange={(e) => setForm({ ...form, officeStart: e.target.value })} />
            </Field>
            <Field label="Office ends" htmlFor="st-end">
              <Input id="st-end" type="time" className="h-10" value={form.officeEnd} onChange={(e) => setForm({ ...form, officeEnd: e.target.value })} />
            </Field>
            <Field label="Lunch starts" htmlFor="st-lstart">
              <Input id="st-lstart" type="time" className="h-10" value={form.lunchStart} onChange={(e) => setForm({ ...form, lunchStart: e.target.value })} />
            </Field>
            <Field label="Lunch ends" htmlFor="st-lend" hint="Lunch time is not counted as work.">
              <Input id="st-lend" type="time" className="h-10" value={form.lunchEnd} onChange={(e) => setForm({ ...form, lunchEnd: e.target.value })} />
            </Field>
            <Field label="Late after (grace minutes)" htmlFor="st-grace">
              <Input id="st-grace" type="number" min="0" className="h-10" value={form.graceMinutes} onChange={(e) => setForm({ ...form, graceMinutes: Number(e.target.value) })} />
            </Field>
            <Field label="Full day = working hours" htmlFor="st-full" hint="After lunch is taken out. Fewer hours = Half Day.">
              <Input id="st-full" type="number" min="1" step="0.5" className="h-10" value={form.fullDayHours} onChange={(e) => setForm({ ...form, fullDayHours: Number(e.target.value) })} />
            </Field>
            <Field label="Half day = hours" htmlFor="st-half">
              <Input id="st-half" type="number" min="1" step="0.5" className="h-10" value={form.halfDayHours} onChange={(e) => setForm({ ...form, halfDayHours: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Weekly off days</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d, i) => {
                const on = form.weeklyOffs.includes(i)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm({ ...form, weeklyOffs: on ? form.weeklyOffs.filter((x) => x !== i) : [...form.weeklyOffs, i] })}
                    className={cn("cursor-pointer rounded-full border px-3 py-1 text-sm", on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}
                  >
                    {d.slice(0, 3)}
                  </button>
                )
              })}
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="cursor-pointer" disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Present people per working day — one series, so no legend; hover shows the full breakdown. */
function TrendChart({ points }: { points: { date: string; present: number; late: number; onLeave: number; absent: number; total: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.total))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-44 items-end gap-[2px]" role="img" aria-label="People present per working day">
        {points.map((p) => (
          <div key={p.date} className="group relative flex h-full flex-1 flex-col items-center justify-end">
            <div
              className="w-full max-w-10 rounded-t-[4px] bg-primary/80 transition-colors group-hover:bg-primary"
              style={{ height: `${Math.max(2, (p.present / max) * 100)}%` }}
            />
            <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden w-40 rounded-lg border bg-popover p-2 text-xs shadow-lg group-hover:block">
              <p className="font-semibold">{formatDate(p.date)}</p>
              <p>Present: {p.present} of {p.total}</p>
              <p className="text-muted-foreground">Late: {p.late} · On leave: {p.onLeave} · Absent: {p.absent}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] text-[10px] text-muted-foreground">
        {points.map((p, i) => (
          <span key={p.date} className="flex-1 text-center">
            {i % 2 === 0 || points.length <= 8 ? p.date.slice(8) : ""}
          </span>
        ))}
      </div>
    </div>
  )
}

export function AttendanceReportClient({
  employees,
  departments,
  settings,
  rows,
  month,
  monthOptions,
  today,
}: {
  employees: EmployeeSummary[]
  departments: NamedOption[]
  settings: HrSettings
  rows: AttendanceRow[]
  month: string
  monthOptions: string[]
  today: string
}) {
  const router = useRouter()
  const [department, setDepartment] = useState(ALL)
  const people = department === ALL ? employees : employees.filter((e) => e.departmentId === department)
  const byEmployee = useMemo(() => {
    const m = new Map<string, AttendanceRow[]>()
    for (const r of rows) m.set(r.employeeId, [...(m.get(r.employeeId) ?? []), r])
    return m
  }, [rows])

  // ---- Today board
  const todayRows = new Map(rows.filter((r) => r.workDate === today).map((r) => [r.employeeId, r]))
  const workingToday = isWorkingDay(today, settings)
  const board = people.map((e) => {
    const r = todayRows.get(e.id)
    const m = r ? attendanceMetrics(r, settings) : null
    return { e, r, m }
  })
  const present = board.filter((b) => b.r && (b.r.status === "Present" || b.r.status === "Half Day"))
  const late = present.filter((b) => b.m?.isLate)
  const onLeave = board.filter((b) => b.r?.status === "On Leave")
  const notIn = board.filter((b) => !b.r || b.r.status === "Absent")
  const workingNow = present.filter((b) => b.m?.inProgress)
  const hoursToday = present.reduce((s, b) => s + (b.m?.workedMinutes ?? 0), 0)

  // ---- Month report
  const monthStart = `${month}-01`
  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10)
  const report = people.map((e) => {
    const joined = e.joiningDate > monthStart ? e.joiningDate : monthStart
    return { e, s: summarizeAttendance(byEmployee.get(e.id) ?? [], joined, monthEnd, settings, today) }
  })
  const deptReport = departments
    .map((d) => {
      const members = report.filter((r) => r.e.departmentId === d.id)
      const sum = (k: keyof (typeof report)[number]["s"]) => members.reduce((s, r) => s + r.s[k], 0)
      const days = sum("workingDays")
      return {
        id: d.id,
        name: d.name,
        people: members.length,
        attendancePct: days ? Math.round(((sum("present") + sum("halfDay") * 0.5) / days) * 100) : 0,
        late: sum("late"),
        absent: sum("absent"),
        onLeave: sum("onLeave"),
        worked: sum("workedMinutes"),
        overtime: sum("overtimeMinutes"),
      }
    })
    .filter((d) => d.people > 0)

  // ---- Trend: last 14 working days
  const trend = (() => {
    const days: string[] = []
    for (const d of datesBetween(new Date(Date.parse(`${today}T00:00:00Z`) - 30 * 86400000).toISOString().slice(0, 10), today).reverse()) {
      if (isWorkingDay(d, settings)) days.push(d)
      if (days.length === 14) break
    }
    return days.reverse().map((d) => {
      const dayRows = rows.filter((r) => r.workDate === d && people.some((p) => p.id === r.employeeId))
      const eligible = people.filter((p) => p.joiningDate <= d).length
      const presentN = dayRows.filter((r) => r.status === "Present" || r.status === "Half Day").length
      const leaveN = dayRows.filter((r) => r.status === "On Leave").length
      return {
        date: d,
        present: presentN,
        late: dayRows.filter((r) => attendanceMetrics(r, settings).isLate).length,
        onLeave: leaveN,
        absent: Math.max(0, eligible - presentN - leaveN),
        total: eligible,
      }
    })
  })()

  function exportReport() {
    downloadCsv(
      `attendance-${month}.csv`,
      report.map(({ e, s }) => ({
        "Employee ID": e.code,
        Name: e.name,
        Department: e.department ?? "",
        "Working days": s.workingDays,
        Present: s.present,
        "Half days": s.halfDay,
        "On leave": s.onLeave,
        Absent: s.absent,
        "Late arrivals": s.late,
        "Left early": s.earlyLeave,
        "Hours worked": (s.workedMinutes / 60).toFixed(1),
        "Overtime hours": (s.overtimeMinutes / 60).toFixed(1),
      }))
    )
  }

  const personRow = (b: (typeof board)[number], extra: React.ReactNode) => (
    <Link key={b.e.id} href={`/hr/employees/${b.e.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/50">
      <span className="flex min-w-0 items-center gap-2">
        <EmployeeAvatar name={b.e.name} photoUrl={b.e.photoUrl} className="size-7" />
        <span className="truncate text-sm font-medium">{b.e.name}</span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">{extra}</span>
    </Link>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Attendance dashboard"
        description={`Office ${settings.officeStart}–${settings.officeEnd} · lunch ${settings.lunchStart}–${settings.lunchEnd} · late after ${settings.graceMinutes} min · weekly off: ${settings.weeklyOffs.map((d) => WEEKDAYS[d].slice(0, 3)).join(", ") || "none"}`}
        actions={
          <>
            <Select value={department} onValueChange={(v) => setDepartment(v ?? ALL)}>
              <SelectTrigger className="h-10 w-48 cursor-pointer">
                <SelectValue>{(v: string) => (v === ALL ? "All departments" : departments.find((d) => d.id === v)?.name ?? v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SettingsDialog settings={settings} />
            <Button variant="outline" className="cursor-pointer" nativeButton={false} render={<Link href="/hr/attendance" />}>
              Edit register
            </Button>
          </>
        }
      />

      <Tabs defaultValue="today">
        <TabsList className="h-11 p-1">
          <TabsTrigger value="today" className="cursor-pointer px-4">Today</TabsTrigger>
          <TabsTrigger value="employees" className="cursor-pointer px-4">Monthly report</TabsTrigger>
          <TabsTrigger value="departments" className="cursor-pointer px-4">By department</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="flex flex-col gap-4">
          {!workingToday ? (
            <p className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">Today is a weekly off.</p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Present" value={String(present.length)} icon={UserCheck} hint={`of ${people.length} people`} />
            <StatCard label="Not checked in" value={String(notIn.length)} icon={Users} hint="Absent so far" />
            <StatCard label="Late" value={String(late.length)} icon={AlarmClock} hint={`after ${settings.officeStart} + ${settings.graceMinutes}m`} />
            <StatCard label="On leave" value={String(onLeave.length)} icon={CalendarRange} />
            <StatCard label="Hours worked today" value={formatMinutes(hoursToday)} icon={Clock} hint={`${workingNow.length} working now`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Present ({present.length})</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-0.5">
                {present.map((b) =>
                  personRow(
                    b,
                    <>
                      {formatOfficeTime(b.r!.checkInAt)}
                      {b.m?.isLate ? <span className="ml-1 font-semibold text-rose-600">late</span> : null}
                      {b.m?.inProgress ? <span className="ml-1 text-emerald-700">· in</span> : ` – ${formatOfficeTime(b.r!.checkOutAt)}`}
                    </>
                  )
                )}
                {present.length === 0 ? <p className="text-sm text-muted-foreground">Nobody yet.</p> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Late ({late.length})</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-0.5">
                {late.map((b) => personRow(b, <span className="font-semibold text-rose-600">{b.m!.lateMinutes} min late</span>))}
                {late.length === 0 ? <p className="text-sm text-muted-foreground">Nobody late.</p> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Not checked in ({notIn.length})</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-0.5">
                {notIn.map((b) => personRow(b, b.e.designation ?? ""))}
                {notIn.length === 0 ? <p className="text-sm text-muted-foreground">Everyone is in.</p> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">On leave ({onLeave.length})</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-0.5">
                {onLeave.map((b) => personRow(b, b.r?.notes ?? ""))}
                {onLeave.length === 0 ? <p className="text-sm text-muted-foreground">Nobody on leave.</p> : null}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" /> People present — last 14 working days
              </CardTitle>
              <CardDescription>Hover a bar for late, leave and absent counts.</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart points={trend} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Select value={month} onValueChange={(v) => v && router.push(`/hr/attendance-report?month=${v}`)}>
              <SelectTrigger className="h-10 w-52 cursor-pointer">
                <CalendarRange className="size-4 text-muted-foreground" />
                <SelectValue>{(v: string) => monthLabel(v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="cursor-pointer" onClick={exportReport}>
              <Download /> Export CSV
            </Button>
          </div>
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Working days</TableHead>
                    <TableHead className="text-right">Present</TableHead>
                    <TableHead className="text-right">Half day</TableHead>
                    <TableHead className="text-right">Leave</TableHead>
                    <TableHead className="text-right">Absent</TableHead>
                    <TableHead className="text-right">Late</TableHead>
                    <TableHead className="text-right">Left early</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Overtime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.map(({ e, s }) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Link href={`/hr/employees/${e.id}`} className="font-medium hover:underline">
                          {e.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {e.code}
                          {e.department ? ` · ${e.department}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">{s.workingDays}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-700">{s.present}</TableCell>
                      <TableCell className="text-right">{s.halfDay}</TableCell>
                      <TableCell className="text-right text-sky-700">{s.onLeave}</TableCell>
                      <TableCell className={cn("text-right", s.absent > 0 && "font-semibold text-rose-700")}>{s.absent}</TableCell>
                      <TableCell className={cn("text-right", s.late > 0 && "text-rose-600")}>{s.late}</TableCell>
                      <TableCell className="text-right">
                        {s.earlyLeave > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <LogOut className="size-3" /> {s.earlyLeave}
                          </span>
                        ) : (
                          0
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatMinutes(s.workedMinutes)}</TableCell>
                      <TableCell className="text-right text-emerald-700">{formatMinutes(s.overtimeMinutes)}</TableCell>
                    </TableRow>
                  ))}
                  {report.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                        No employees.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">
                A past working day with no check-in and no leave counts as absent. Days before joining are not counted.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments">
          <Card>
            <CardHeader>
              <CardTitle>Department-wise — {monthLabel(month)}</CardTitle>
              <CardDescription>Attendance % counts a half day as half.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">People</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead className="text-right">Absent days</TableHead>
                    <TableHead className="text-right">Leave days</TableHead>
                    <TableHead className="text-right">Late arrivals</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Overtime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deptReport.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-right">{d.people}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${d.attendancePct}%` }} />
                          </div>
                          <span className="text-sm font-semibold">{d.attendancePct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{d.absent}</TableCell>
                      <TableCell className="text-right">{d.onLeave}</TableCell>
                      <TableCell className="text-right">{d.late}</TableCell>
                      <TableCell className="text-right">{formatMinutes(d.worked)}</TableCell>
                      <TableCell className="text-right">{formatMinutes(d.overtime)}</TableCell>
                    </TableRow>
                  ))}
                  {deptReport.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        Put employees in departments (Organization page) to see this report.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

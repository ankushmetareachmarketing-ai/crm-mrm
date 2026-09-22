"use client"

import { useMemo, useState } from "react"
import { AlarmClock, CalendarCheck, Download, IndianRupee, LogIn, LogOut, Users2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency, formatDate } from "@/lib/format"
import { downloadCsv } from "@/lib/export-csv"
import { cn } from "@/lib/utils"
import type { AttendanceEntry, AttendanceStatus } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const STATUSES: AttendanceStatus[] = ["Present", "Half Day", "Absent", "On Leave"]

const DOT_CLASS: Record<AttendanceStatus, string> = {
  Present: "bg-emerald-500",
  "Half Day": "bg-amber-500",
  Absent: "bg-rose-500",
  "On Leave": "bg-sky-500",
}

const CELL_CLASS: Record<AttendanceStatus, string> = {
  Present: "bg-emerald-50 border-emerald-200",
  "Half Day": "bg-amber-50 border-amber-200",
  Absent: "bg-rose-50 border-rose-200",
  "On Leave": "bg-sky-50 border-sky-200",
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7)
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7)
}

function formatMonth(key: string) {
  const date = new Date(`${key}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return key
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(date)
}

function formatTime(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
}

function daysInMonth(key: string) {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m, 0).getDate()
}

function firstWeekday(key: string) {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1, 1).getDay()
}

interface EmployeeLite {
  id: string
  name: string
  active: boolean
  salary: number | null
}

const emptyDayForm = {
  status: "Present" as AttendanceStatus,
  checkInTime: "",
  checkOutTime: "",
  penaltyAmount: "",
  penaltyReason: "",
  notes: "",
}

export function AttendanceClient({
  currentEmployeeId,
  canManage,
  employees,
  initialEntries,
  initialTab = "attendance",
}: {
  currentEmployeeId: string
  canManage: boolean
  employees: EmployeeLite[]
  initialEntries: AttendanceEntry[]
  initialTab?: "attendance" | "salary"
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(currentEmployeeId)
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey())
  const [salaryMonth, setSalaryMonth] = useState(currentMonthKey())
  const [punching, setPunching] = useState(false)
  const [punchError, setPunchError] = useState<string | null>(null)

  const [dayDialogDate, setDayDialogDate] = useState<string | null>(null)
  const [dayForm, setDayForm] = useState(emptyDayForm)
  const [daySubmitting, setDaySubmitting] = useState(false)
  const [dayError, setDayError] = useState<string | null>(null)

  const myToday = entries.find((e) => e.employeeId === currentEmployeeId && e.workDate === todayKey())

  async function handleCheckIn() {
    setPunching(true)
    setPunchError(null)
    try {
      const res = await fetch("/api/attendance/check-in", { method: "POST" })
      const body = await res.json()
      if (!res.ok) {
        setPunchError(body.error ?? "Could not check in.")
        return
      }
      setEntries((prev) => {
        const existing = prev.find((e) => e.employeeId === currentEmployeeId && e.workDate === todayKey())
        if (existing) {
          return prev.map((e) => (e === existing ? { ...e, checkInAt: body.checkInAt } : e))
        }
        return [
          {
            id: `local-${Date.now()}`,
            employeeId: currentEmployeeId,
            employeeName: employees.find((e) => e.id === currentEmployeeId)?.name ?? "",
            workDate: todayKey(),
            checkInAt: body.checkInAt,
            checkOutAt: null,
            status: "Present",
            penaltyAmount: 0,
            penaltyReason: null,
            notes: null,
          },
          ...prev,
        ]
      })
    } finally {
      setPunching(false)
    }
  }

  async function handleCheckOut() {
    setPunching(true)
    setPunchError(null)
    try {
      const res = await fetch("/api/attendance/check-out", { method: "POST" })
      const body = await res.json()
      if (!res.ok) {
        setPunchError(body.error ?? "Could not check out.")
        return
      }
      setEntries((prev) =>
        prev.map((e) =>
          e.employeeId === currentEmployeeId && e.workDate === todayKey()
            ? { ...e, checkOutAt: body.checkOutAt, status: body.status }
            : e
        )
      )
    } finally {
      setPunching(false)
    }
  }

  function openDay(dateStr: string) {
    if (!canManage) return
    const existing = entries.find((e) => e.employeeId === selectedEmployeeId && e.workDate === dateStr)
    setDayForm({
      status: existing?.status ?? "Present",
      checkInTime: existing?.checkInAt ? new Date(existing.checkInAt).toISOString().slice(11, 16) : "",
      checkOutTime: existing?.checkOutAt ? new Date(existing.checkOutAt).toISOString().slice(11, 16) : "",
      penaltyAmount: existing?.penaltyAmount ? String(existing.penaltyAmount) : "",
      penaltyReason: existing?.penaltyReason ?? "",
      notes: existing?.notes ?? "",
    })
    setDayError(null)
    setDayDialogDate(dateStr)
  }

  async function handleSaveDay() {
    if (!dayDialogDate) return
    setDaySubmitting(true)
    setDayError(null)
    try {
      const res = await fetch("/api/attendance/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          workDate: dayDialogDate,
          status: dayForm.status,
          checkInTime: dayForm.checkInTime || null,
          checkOutTime: dayForm.checkOutTime || null,
          penaltyAmount: dayForm.penaltyAmount || 0,
          penaltyReason: dayForm.penaltyReason || null,
          notes: dayForm.notes || null,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setDayError(body.error ?? "Could not save this record.")
        return
      }
      const employeeName = employees.find((e) => e.id === selectedEmployeeId)?.name ?? ""
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.employeeId === selectedEmployeeId && e.workDate === dayDialogDate)
        const next: AttendanceEntry = { ...body, employeeName }
        if (idx === -1) return [next, ...prev]
        return prev.map((e, i) => (i === idx ? next : e))
      })
      setDayDialogDate(null)
    } finally {
      setDaySubmitting(false)
    }
  }

  const monthOptions = useMemo(() => {
    const set = new Set(entries.map((e) => monthKey(e.workDate)))
    set.add(currentMonthKey())
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [entries])

  const calendarCells = useMemo(() => {
    const total = daysInMonth(selectedMonth)
    const offset = firstWeekday(selectedMonth)
    const byDate = new Map(
      entries.filter((e) => e.employeeId === selectedEmployeeId).map((e) => [e.workDate, e])
    )
    const cells: { date: string | null; entry: AttendanceEntry | null }[] = []
    for (let i = 0; i < offset; i++) cells.push({ date: null, entry: null })
    for (let d = 1; d <= total; d++) {
      const date = `${selectedMonth}-${String(d).padStart(2, "0")}`
      cells.push({ date, entry: byDate.get(date) ?? null })
    }
    return cells
  }, [entries, selectedEmployeeId, selectedMonth])

  const monthSummary = useMemo(() => {
    const monthEntries = entries.filter(
      (e) => e.employeeId === selectedEmployeeId && monthKey(e.workDate) === selectedMonth
    )
    return {
      present: monthEntries.filter((e) => e.status === "Present").length,
      halfDay: monthEntries.filter((e) => e.status === "Half Day").length,
      absent: monthEntries.filter((e) => e.status === "Absent").length,
      onLeave: monthEntries.filter((e) => e.status === "On Leave").length,
      penalty: monthEntries.reduce((sum, e) => sum + e.penaltyAmount, 0),
    }
  }, [entries, selectedEmployeeId, selectedMonth])

  const todayAll = useMemo(
    () => employees.map((emp) => ({ emp, entry: entries.find((e) => e.employeeId === emp.id && e.workDate === todayKey()) })),
    [employees, entries]
  )

  const payrollRows = useMemo(() => {
    return employees.map((emp) => {
      const penalty = entries
        .filter((e) => e.employeeId === emp.id && monthKey(e.workDate) === salaryMonth)
        .reduce((sum, e) => sum + e.penaltyAmount, 0)
      const salary = emp.salary ?? 0
      return { employee: emp, salary, penalty, net: salary - penalty }
    })
  }, [employees, entries, salaryMonth])

  function exportPayroll() {
    downloadCsv(
      `payroll-${salaryMonth}.csv`,
      payrollRows.map((r) => ({
        Employee: r.employee.name,
        "Base salary": r.salary,
        Penalty: r.penalty,
        "Net payable": r.net,
      }))
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Attendance"
        description="Check in and out daily. Checking out before 2:00 PM marks the day as a half day."
      />

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <p className="text-sm font-medium">Today — {formatDate(todayKey())}</p>
            <p className="text-sm text-muted-foreground">
              {myToday?.checkInAt ? `Checked in ${formatTime(myToday.checkInAt)}` : "Not checked in yet"}
              {myToday?.checkOutAt ? ` · Checked out ${formatTime(myToday.checkOutAt)}` : ""}
            </p>
            {punchError ? <p className="text-sm text-destructive">{punchError}</p> : null}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCheckIn} disabled={punching || !!myToday?.checkInAt}>
              <LogIn /> Check in
            </Button>
            <Button
              variant="outline"
              onClick={handleCheckOut}
              disabled={punching || !myToday?.checkInAt || !!myToday?.checkOutAt}
            >
              <LogOut /> Check out
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          {canManage ? <TabsTrigger value="salary">Salary</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="attendance" className="flex flex-col gap-6 pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {canManage ? (
              <Select value={selectedEmployeeId} onValueChange={(v) => v && setSelectedEmployeeId(v)}>
                <SelectTrigger className="h-10 w-56 text-base">
                  <SelectValue placeholder="Employee">
                    {(v: string) => employees.find((e) => e.id === v)?.name ?? "Employee"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={selectedMonth} onValueChange={(v) => v && setSelectedMonth(v)}>
              <SelectTrigger className="h-10 w-48 text-base">
                <SelectValue placeholder="Month">{(v: string) => formatMonth(v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMonth(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Present" value={String(monthSummary.present)} icon={CalendarCheck} />
            <StatCard label="Half day" value={String(monthSummary.halfDay)} icon={AlarmClock} />
            <StatCard label="Absent" value={String(monthSummary.absent)} icon={Users2} />
            <StatCard label="On leave" value={String(monthSummary.onLeave)} icon={Users2} />
            <StatCard label="Penalty" value={formatCurrency(monthSummary.penalty)} icon={IndianRupee} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{formatMonth(selectedMonth)}</CardTitle>
              <CardDescription>
                {canManage ? "Click a day to edit it — set status, times or a penalty." : "Your attendance calendar."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted-foreground">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarCells.map((cell, i) =>
                  cell.date ? (
                    <button
                      key={cell.date}
                      type="button"
                      disabled={!canManage}
                      onClick={() => openDay(cell.date!)}
                      className={cn(
                        "flex min-h-16 flex-col items-start rounded-lg border p-2 text-left transition-colors",
                        cell.entry ? CELL_CLASS[cell.entry.status] : "bg-muted/30 border-transparent",
                        canManage && "cursor-pointer hover:border-primary"
                      )}
                    >
                      <span className="text-xs font-medium">{Number(cell.date.slice(8, 10))}</span>
                      {cell.entry ? (
                        <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <span className={cn("size-1.5 rounded-full", DOT_CLASS[cell.entry.status])} />
                          {cell.entry.status}
                        </span>
                      ) : null}
                      {cell.entry && cell.entry.penaltyAmount > 0 ? (
                        <span className="mt-0.5 text-[11px] text-destructive">
                          -{formatCurrency(cell.entry.penaltyAmount)}
                        </span>
                      ) : null}
                    </button>
                  ) : (
                    <div key={`empty-${i}`} />
                  )
                )}
              </div>
            </CardContent>
          </Card>

          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle>Today — all employees</CardTitle>
                <CardDescription>Quick check of who&apos;s checked in.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayAll.map(({ emp, entry }) => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatTime(entry?.checkInAt ?? null)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatTime(entry?.checkOutAt ?? null)}</TableCell>
                        <TableCell>{entry ? <StatusBadge status={entry.status} /> : <span className="text-sm text-muted-foreground">—</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {canManage ? (
          <TabsContent value="salary" className="flex flex-col gap-4 pt-4">
            <div className="flex items-center justify-between gap-2">
              <Select value={salaryMonth} onValueChange={(v) => v && setSalaryMonth(v)}>
                <SelectTrigger className="h-10 w-48 text-base">
                  <SelectValue placeholder="Month">{(v: string) => formatMonth(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {formatMonth(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={exportPayroll}>
                <Download /> Export CSV
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Payroll — {formatMonth(salaryMonth)}</CardTitle>
                <CardDescription>Base salary minus any attendance penalties for the month.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Base salary</TableHead>
                      <TableHead className="text-right">Penalty</TableHead>
                      <TableHead className="text-right">Net payable</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollRows.map((r) => (
                      <TableRow key={r.employee.id}>
                        <TableCell className="font-medium">{r.employee.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.salary)}</TableCell>
                        <TableCell className="text-right text-destructive">
                          {r.penalty > 0 ? `-${formatCurrency(r.penalty)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(r.net)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>

      <Dialog open={!!dayDialogDate} onOpenChange={(v) => !v && setDayDialogDate(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">{dayDialogDate ? formatDate(dayDialogDate) : ""}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={dayForm.status} onValueChange={(v) => v && setDayForm((f) => ({ ...f, status: v as AttendanceStatus }))}>
                <SelectTrigger className="h-10 w-full text-base">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="day-checkin">Check-in time</Label>
                <Input
                  id="day-checkin"
                  type="time"
                  className="h-10 text-base"
                  value={dayForm.checkInTime}
                  onChange={(e) => setDayForm((f) => ({ ...f, checkInTime: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="day-checkout">Check-out time</Label>
                <Input
                  id="day-checkout"
                  type="time"
                  className="h-10 text-base"
                  value={dayForm.checkOutTime}
                  onChange={(e) => setDayForm((f) => ({ ...f, checkOutTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="day-penalty">Penalty (₹)</Label>
                <Input
                  id="day-penalty"
                  type="number"
                  className="h-10 text-base"
                  value={dayForm.penaltyAmount}
                  onChange={(e) => setDayForm((f) => ({ ...f, penaltyAmount: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="day-penalty-reason">Penalty reason</Label>
                <Input
                  id="day-penalty-reason"
                  className="h-10 text-base"
                  value={dayForm.penaltyReason}
                  onChange={(e) => setDayForm((f) => ({ ...f, penaltyReason: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="day-notes">Notes</Label>
              <Textarea
                id="day-notes"
                value={dayForm.notes}
                onChange={(e) => setDayForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            {dayError ? <p className="text-sm text-destructive">{dayError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDayDialogDate(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDay} disabled={daySubmitting}>
              {daySubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

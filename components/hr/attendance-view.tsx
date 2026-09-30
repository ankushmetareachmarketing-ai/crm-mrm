"use client"

import { useState } from "react"
import { AlarmClock, CalendarRange, Clock, LogOut, TrendingUp, UserCheck } from "@/components/icons"
import { StatCard } from "@/components/stat-card"
import {
  attendanceMetrics,
  isWorkingDay,
  summarizeAttendance,
  type HrSettings,
} from "@/lib/hr/attendance"
import { datesBetween, formatMinutes, formatOfficeTime, officeDateKey } from "@/lib/hr/time"
import type { AttendanceRow } from "@/lib/hr/types"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

export const DAY_STYLE: Record<string, string> = {
  Present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Half Day": "bg-amber-50 text-amber-700 border-amber-200",
  "On Leave": "bg-sky-50 text-sky-700 border-sky-200",
  Absent: "bg-rose-50 text-rose-700 border-rose-200",
  "Weekly off": "bg-slate-50 text-slate-500 border-slate-200",
}

export function DayBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap", DAY_STYLE[status])}>
      {status}
    </span>
  )
}

function monthLabel(key: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(`${key}-01T00:00:00`))
}

/** One employee's attendance for a chosen month: summary cards + a day-by-day table. */
export function AttendanceView({
  records,
  settings,
  months,
}: {
  records: AttendanceRow[]
  settings: HrSettings
  /** YYYY-MM keys available in the picker, newest first. */
  months: string[]
}) {
  const [month, setMonth] = useState(months[0])
  const today = officeDateKey()
  const start = `${month}-01`
  const end = `${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()).padStart(2, "0")}`
  const inMonth = records.filter((r) => r.workDate >= start && r.workDate <= end)
  const summary = summarizeAttendance(inMonth, start, end, settings, today)

  const byDate = new Map(inMonth.map((r) => [r.workDate, r]))
  const days = datesBetween(start, end < today ? end : today)
      .reverse()
      .map((d) => {
        const r = byDate.get(d)
        const off = !isWorkingDay(d, settings)
        return { date: d, record: r, status: r ? r.status : off ? "Weekly off" : d < today ? "Absent" : null }
      })
      .filter((d) => d.status !== null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Office hours {settings.officeStart}–{settings.officeEnd}, lunch {settings.lunchStart}–{settings.lunchEnd} (not counted), {settings.graceMinutes} min grace.
        </p>
        <Select value={month} onValueChange={(v) => setMonth(v ?? months[0])}>
          <SelectTrigger className="h-10 w-48 cursor-pointer">
            <CalendarRange className="size-4 text-muted-foreground" />
            <SelectValue>{(v: string) => monthLabel(v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {monthLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Present" value={`${summary.present + summary.halfDay * 0.5}`} icon={UserCheck} hint={`of ${summary.workingDays} working days`} />
        <StatCard label="Absent" value={String(summary.absent)} icon={CalendarRange} hint={`${summary.onLeave} on leave`} />
        <StatCard label="Late arrivals" value={String(summary.late)} icon={AlarmClock} hint={`${summary.earlyLeave} left early`} />
        <StatCard label="Hours worked" value={formatMinutes(summary.workedMinutes)} icon={Clock} />
        <StatCard label="Overtime" value={formatMinutes(summary.overtimeMinutes)} icon={TrendingUp} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Day by day</CardTitle>
          <CardDescription>{monthLabel(month)}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check in</TableHead>
                <TableHead>Check out</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map(({ date, record, status }) => {
                const m = record ? attendanceMetrics(record, settings) : null
                return (
                  <TableRow key={date}>
                    <TableCell className="text-sm whitespace-nowrap">{formatDate(date)}</TableCell>
                    <TableCell>
                      <DayBadge status={status!} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatOfficeTime(record?.checkInAt ?? null)}
                      {m?.isLate ? <span className="ml-1.5 text-xs font-semibold text-rose-600">Late {m.lateMinutes}m</span> : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m?.inProgress ? <span className="text-xs font-semibold text-emerald-700">Working now</span> : formatOfficeTime(record?.checkOutAt ?? null)}
                      {m?.leftEarly ? (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-amber-700">
                          <LogOut className="size-3" /> Early
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {m && m.workedMinutes > 0 ? formatMinutes(m.workedMinutes) : "—"}
                      {m && m.overtimeMinutes > 0 ? (
                        <span className="ml-1 text-xs text-emerald-700">+{formatMinutes(m.overtimeMinutes)}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record?.notes ?? ""}</TableCell>
                  </TableRow>
                )
              })}
              {days.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No days to show.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

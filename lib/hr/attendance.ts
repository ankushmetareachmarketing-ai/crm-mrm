// Attendance rules shared by the server and the browser. Late / early /
// overtime are derived from the stored check-in/out times and the office
// rules in hr_settings, so changing office hours re-evaluates history.

import { datesBetween, officeDateKey, officeMinutesOfDay, timeToMinutes, weekdayOf } from "@/lib/hr/time"

export interface HrSettings {
  officeStart: string
  officeEnd: string
  /** Lunch break — time inside it is not counted as work. */
  lunchStart: string
  lunchEnd: string
  graceMinutes: number
  fullDayHours: number
  halfDayHours: number
  weeklyOffs: number[]
}

export const DEFAULT_HR_SETTINGS: HrSettings = {
  officeStart: "10:00",
  officeEnd: "18:00",
  lunchStart: "13:30",
  lunchEnd: "14:00",
  graceMinutes: 15,
  fullDayHours: 7.5,
  halfDayHours: 4,
  weeklyOffs: [0],
}

export type AttendanceDayStatus = "Present" | "Half Day" | "Absent" | "On Leave"

export interface AttendanceRecord {
  employeeId: string
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  status: AttendanceDayStatus
}

export interface AttendanceMetrics {
  workedMinutes: number
  lateMinutes: number
  earlyLeaveMinutes: number
  overtimeMinutes: number
  isLate: boolean
  leftEarly: boolean
  /** Checked in but not yet out. */
  inProgress: boolean
}

/** Late arrival, early leaving, working hours and overtime for one day. */
export function attendanceMetrics(record: AttendanceRecord, settings: HrSettings, now = new Date()): AttendanceMetrics {
  const start = timeToMinutes(settings.officeStart)
  const end = timeToMinutes(settings.officeEnd)
  const inMin = record.checkInAt ? officeMinutesOfDay(record.checkInAt) : null
  const outMin = record.checkOutAt ? officeMinutesOfDay(record.checkOutAt) : null
  const inProgress = Boolean(record.checkInAt && !record.checkOutAt && record.workDate === officeDateKey(now))

  let workedMinutes = 0
  if (record.checkInAt && inMin !== null) {
    const endAt = record.checkOutAt ? new Date(record.checkOutAt) : inProgress ? now : null
    if (endAt) {
      const total = Math.max(0, Math.round((endAt.getTime() - new Date(record.checkInAt).getTime()) / 60000))
      // Take out the part of the lunch break that falls inside the day worked.
      const lastMin = inMin + total
      const lunch = Math.max(0, Math.min(lastMin, timeToMinutes(settings.lunchEnd)) - Math.max(inMin, timeToMinutes(settings.lunchStart)))
      workedMinutes = Math.max(0, total - lunch)
    }
  }

  const lateMinutes = inMin !== null ? Math.max(0, inMin - start) : 0
  const isLate = inMin !== null && lateMinutes > settings.graceMinutes
  const earlyLeaveMinutes = outMin !== null ? Math.max(0, end - outMin) : 0
  const leftEarly = outMin !== null && earlyLeaveMinutes > 0 && record.status !== "Half Day"
  const overtimeMinutes = record.checkOutAt ? Math.max(0, workedMinutes - settings.fullDayHours * 60) : 0

  return {
    workedMinutes,
    lateMinutes: isLate ? lateMinutes : 0,
    earlyLeaveMinutes: leftEarly ? earlyLeaveMinutes : 0,
    overtimeMinutes,
    isLate,
    leftEarly,
    inProgress,
  }
}

/**
 * Status a finished day earns from hours worked (used at check-out): the
 * full-day hours (less the grace period) make it Present, anything shorter
 * is a Half Day. HR can still override it in the attendance register.
 */
export function statusFromWorkedMinutes(workedMinutes: number, settings: HrSettings): AttendanceDayStatus {
  return workedMinutes >= settings.fullDayHours * 60 - settings.graceMinutes ? "Present" : "Half Day"
}

export function isWorkingDay(dateKey: string, settings: HrSettings) {
  return !settings.weeklyOffs.includes(weekdayOf(dateKey))
}

/** Working days (weekly offs excluded) from start to end, capped at today. */
export function workingDaysBetween(start: string, end: string, settings: HrSettings, today = officeDateKey()) {
  const last = end < today ? end : today
  if (last < start) return []
  return datesBetween(start, last).filter((d) => isWorkingDay(d, settings))
}

export interface AttendanceSummary {
  workingDays: number
  present: number
  halfDay: number
  onLeave: number
  absent: number
  late: number
  earlyLeave: number
  workedMinutes: number
  overtimeMinutes: number
}

/**
 * Summary for one employee over a period. A working day with no record
 * (before today) counts as absent; today only counts once it has a record.
 */
export function summarizeAttendance(
  records: AttendanceRecord[],
  start: string,
  end: string,
  settings: HrSettings,
  today = officeDateKey()
): AttendanceSummary {
  const byDate = new Map(records.map((r) => [r.workDate, r]))
  const s: AttendanceSummary = {
    workingDays: 0,
    present: 0,
    halfDay: 0,
    onLeave: 0,
    absent: 0,
    late: 0,
    earlyLeave: 0,
    workedMinutes: 0,
    overtimeMinutes: 0,
  }
  for (const day of workingDaysBetween(start, end, settings, today)) {
    const r = byDate.get(day)
    if (!r) {
      if (day < today) {
        s.workingDays += 1
        s.absent += 1
      }
      continue
    }
    s.workingDays += 1
    if (r.status === "Present") s.present += 1
    else if (r.status === "Half Day") s.halfDay += 1
    else if (r.status === "On Leave") s.onLeave += 1
    else s.absent += 1
    const m = attendanceMetrics(r, settings)
    if (m.isLate) s.late += 1
    if (m.leftEarly) s.earlyLeave += 1
    s.workedMinutes += m.workedMinutes
    s.overtimeMinutes += m.overtimeMinutes
  }
  return s
}

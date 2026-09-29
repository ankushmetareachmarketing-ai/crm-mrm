import { isWorkingDay, type HrSettings } from "@/lib/hr/attendance"
import { datesBetween } from "@/lib/hr/time"

export type LeaveStatus = "Pending" | "Approved" | "Rejected" | "Cancelled"

/** Leave days a request uses: working days only, 0.5 for a single half day. */
export function leaveDays(start: string, end: string, halfDay: boolean, settings: HrSettings) {
  const days = datesBetween(start, end).filter((d) => isWorkingDay(d, settings)).length
  if (halfDay && start === end) return days > 0 ? 0.5 : 0
  return days
}

export interface LeaveBalance {
  leaveTypeId: string
  name: string
  paid: boolean
  /** null = no yearly limit */
  allowed: number | null
  used: number
  pending: number
  /** null when there is no limit */
  remaining: number | null
}

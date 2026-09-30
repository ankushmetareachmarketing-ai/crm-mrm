import { getAttendanceRows, getEmployeeDirectory, getOrgOptions } from "@/lib/data/hr"
import { getHrSettings, requireHrManager } from "@/lib/hr/server"
import { officeDateKey } from "@/lib/hr/time"
import { AttendanceReportClient } from "./attendance-report-client"

export default async function AttendanceReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireHrManager()
  const today = officeDateKey()
  const { month: requested } = await searchParams
  const month = requested && /^\d{4}-\d{2}$/.test(requested) && requested <= today.slice(0, 7) ? requested : today.slice(0, 7)

  // Load the chosen month plus the last ~3 weeks so the trend always has data.
  const trendStart = new Date(`${today}T00:00:00Z`)
  trendStart.setUTCDate(trendStart.getUTCDate() - 24)
  const monthStart = `${month}-01`
  const start = monthStart < trendStart.toISOString().slice(0, 10) ? monthStart : trendStart.toISOString().slice(0, 10)
  // Always up to today, so the "Today" tab and trend have current data.
  const end = today

  const [employees, org, settings, rows] = await Promise.all([
    getEmployeeDirectory(),
    getOrgOptions(),
    getHrSettings(),
    getAttendanceRows(start, end),
  ])

  const monthOptions: string[] = []
  const cursor = new Date(`${today.slice(0, 7)}-01T00:00:00Z`)
  for (let i = 0; i < 12; i++) {
    monthOptions.push(cursor.toISOString().slice(0, 7))
    cursor.setUTCMonth(cursor.getUTCMonth() - 1)
  }

  return (
    <AttendanceReportClient
      employees={employees.filter((e) => ["Onboarding", "Probation", "Active", "Notice Period"].includes(e.status))}
      departments={org.departments}
      settings={settings}
      rows={rows}
      month={month}
      monthOptions={monthOptions}
      today={today}
    />
  )
}

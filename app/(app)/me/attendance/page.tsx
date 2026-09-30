import { PageHeader } from "@/components/page-header"
import { AttendanceView } from "@/components/hr/attendance-view"
import { CheckInCard } from "@/components/hr/check-in-card"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import { getAttendanceRows } from "@/lib/data/hr"
import { getTodayAttendance } from "@/lib/data/me"
import { getHrSettings } from "@/lib/hr/server"
import { officeDateKey } from "@/lib/hr/time"

export default async function MyAttendancePage() {
  const me = await getCurrentEmployee()
  const today = officeDateKey()
  const since = new Date(`${today.slice(0, 7)}-01T00:00:00Z`)
  since.setUTCMonth(since.getUTCMonth() - 5)
  const [settings, todayEntry, rows] = await Promise.all([
    getHrSettings(),
    getTodayAttendance(me.id),
    getAttendanceRows(since.toISOString().slice(0, 10), today, me.id),
  ])
  const months = Array.from(new Set([today.slice(0, 7), ...rows.map((r) => r.workDate.slice(0, 7))])).sort().reverse()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My attendance" description="Check in when you start, check out when you leave." />
      <CheckInCard today={todayEntry} settings={settings} employeeId={me.id} />
      <AttendanceView records={rows} settings={settings} months={months} />
    </div>
  )
}

import { CalendarRange, Clock, UserCheck } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { LeaveRequestsCard } from "@/components/hr/leave-parts"
import { getLeaveRequests } from "@/lib/data/hr"
import { requireHrManager } from "@/lib/hr/server"
import { officeDateKey } from "@/lib/hr/time"

export default async function LeaveManagementPage() {
  await requireHrManager()
  const requests = await getLeaveRequests()
  const today = officeDateKey()

  const pending = requests.filter((r) => r.status === "Pending")
  const approved = requests.filter((r) => r.status === "Approved")
  const onLeaveToday = approved.filter((r) => r.startDate <= today && r.endDate >= today)
  const upcoming = approved.filter((r) => r.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate))
  const decided = requests.filter((r) => r.status !== "Pending")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Leave" description="Approve requests and see who is away. Approving marks those days “On Leave” in attendance." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Waiting for you" value={String(pending.length)} icon={Clock} hint="Pending requests" />
        <StatCard label="On leave today" value={String(onLeaveToday.length)} icon={UserCheck} hint={onLeaveToday.map((r) => r.employee).join(", ") || "Nobody"} />
        <StatCard label="Upcoming leave" value={String(upcoming.length)} icon={CalendarRange} hint="Approved, not started yet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LeaveRequestsCard
          requests={pending}
          mode="decide"
          showEmployee
          title="Waiting for approval"
          description="Oldest first. The employee is notified of your decision."
        />
        <LeaveRequestsCard requests={[...onLeaveToday, ...upcoming]} mode="none" showEmployee title="Away today & coming up" />
      </div>

      <LeaveRequestsCard requests={decided} mode="none" showEmployee title="All decided requests" />
    </div>
  )
}

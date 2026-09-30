import { PageHeader } from "@/components/page-header"
import { ApplyLeaveDialog, LeaveBalances, LeaveRequestsCard } from "@/components/hr/leave-parts"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import { getLeaveRequests, getLeaveTypes } from "@/lib/data/hr"
import { getLeaveBalances } from "@/lib/hr/server"
import { officeDateKey } from "@/lib/hr/time"

export default async function MyLeavePage() {
  const me = await getCurrentEmployee()
  const year = Number(officeDateKey().slice(0, 4))
  const [types, balances, requests] = await Promise.all([getLeaveTypes(), getLeaveBalances(me.id, year), getLeaveRequests(me.id)])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My leave"
        description={`Your leave balance for ${year}. HR is told as soon as you apply.`}
        actions={<ApplyLeaveDialog leaveTypes={types} />}
      />
      <LeaveBalances balances={balances} />
      <LeaveRequestsCard requests={requests} mode="cancel" title="My requests" description="You can cancel a request while it is still waiting." />
    </div>
  )
}

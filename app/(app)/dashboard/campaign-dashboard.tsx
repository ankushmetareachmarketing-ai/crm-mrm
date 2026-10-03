import { PageHeader } from "@/components/page-header"
import { CheckInCard } from "@/components/hr/check-in-card"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import { getCampaigns } from "@/lib/data/campaigns"
import { getTodayAttendance } from "@/lib/data/me"
import { getHrSettings } from "@/lib/hr/server"
import { CampaignBoard } from "./campaign-board"

/** Dashboard for the Campaign Manager: SMS / Voice campaigns approved by the Owner. */
export async function CampaignDashboard() {
  const me = await getCurrentEmployee()
  const [campaigns, settings, today] = await Promise.all([getCampaigns({ includeOwnerPending: false }), getHrSettings(), getTodayAttendance(me.id)])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Campaign Dashboard"
        description="SMS and Voice campaigns the Owner has approved. Approve them, start them, and mark them done."
      />
      <CheckInCard today={today} settings={settings} employeeId={me.id} />
      <CampaignBoard campaigns={campaigns} canAct />
    </div>
  )
}

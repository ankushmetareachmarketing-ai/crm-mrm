import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import { getCampaigns } from "@/lib/data/campaigns"
import { CampaignBoard } from "../dashboard/campaign-board"

/** All Owner-approved SMS / Voice campaigns, for the Campaign Manager and the Owner. */
export default async function CampaignQueuePage() {
  const me = await getCurrentEmployee()
  if (me.role !== "Campaign Manager" && me.role !== "Owner") notFound()
  // Campaign Manager: only Owner-approved campaigns. Owner: also the ones waiting for them.
  const campaigns = await getCampaigns({ includeOwnerPending: me.role === "Owner" })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Campaigns"
        description="SMS and Voice campaigns approved by the Owner — approve, start and finish them here."
      />
      <CampaignBoard campaigns={campaigns} canAct />
    </div>
  )
}

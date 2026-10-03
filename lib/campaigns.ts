// SMS / Voice campaigns: after the Owner approves the booking they go to
// the Campaign Manager, who approves and runs them. Shared by server and UI.

import { testedServiceOf } from "@/lib/billing"

export const CAMPAIGN_SERVICES = ["SMS Campaign", "Voice Campaign"]

export type CampaignStatus = "Pending" | "Approved" | "Running" | "Completed" | "Rejected"

/** True for an SMS / Voice campaign, including a testing campaign ("Testing – SMS Campaign"). */
export function isCampaignService(service: string | null | undefined) {
  if (!service) return false
  return CAMPAIGN_SERVICES.includes(service) || CAMPAIGN_SERVICES.includes(testedServiceOf(service))
}

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  Pending: "Waiting for Campaign Manager",
  Approved: "Campaign approved",
  Running: "Campaign running",
  Completed: "Campaign done",
  Rejected: "Campaign rejected",
}

export const CAMPAIGN_STATUS_STYLE: Record<CampaignStatus, string> = {
  Pending: "border-amber-300 bg-amber-50 text-amber-800",
  Approved: "border-sky-300 bg-sky-50 text-sky-800",
  Running: "border-violet-300 bg-violet-50 text-violet-800",
  Completed: "border-emerald-300 bg-emerald-50 text-emerald-800",
  Rejected: "border-rose-300 bg-rose-50 text-rose-700",
}

/** Which statuses the Campaign Manager can move a campaign to next. */
export const CAMPAIGN_NEXT: Record<CampaignStatus, CampaignStatus[]> = {
  Pending: ["Approved", "Rejected"],
  Approved: ["Running", "Rejected"],
  Running: ["Completed"],
  Completed: [],
  Rejected: ["Approved"],
}

export const CAMPAIGN_ACTION_LABEL: Record<CampaignStatus, string> = {
  Pending: "Back to waiting",
  Approved: "Approve",
  Running: "Start campaign",
  Completed: "Mark done",
  Rejected: "Reject",
}

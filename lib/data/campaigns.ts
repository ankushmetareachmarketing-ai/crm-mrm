import "server-only"
import { testingServiceName, type ApprovalStatus, type GstType } from "@/lib/billing"
import { CAMPAIGN_SERVICES } from "@/lib/campaigns"
import type { CampaignStatus } from "@/lib/campaigns"
import { pool } from "@/lib/db"

export interface CampaignRow {
  id: string
  clientId: string
  company: string
  service: string
  quantity: number
  rate: number
  total: number
  gstType: GstType
  serviceDate: string
  notes: string | null
  salesPerson: string | null
  addedBy: string | null
  ownerApprovedAt: string | null
  /** The Owner's decision on the booking; the Campaign Manager acts only once it is Approved. */
  ownerStatus: ApprovalStatus
  /** Null until the Owner approves (or if the Owner rejected it). */
  status: CampaignStatus | null
  decidedBy: string | null
  decidedAt: string | null
  campaignNote: string | null
}

/**
 * SMS / Voice campaigns (incl. testing ones), waiting ones on top. The
 * Campaign Manager only ever sees campaigns the Owner has approved; the
 * Owner can also see the ones still waiting for their own approval.
 */
export async function getCampaigns({ includeOwnerPending }: { includeOwnerPending: boolean }): Promise<CampaignRow[]> {
  const { rows } = await pool.query<{
    id: string
    client_id: string
    company: string
    service: string
    quantity: string
    rate: string
    total_amount: string
    gst_type: GstType
    charge_date: string
    notes: string | null
    sales_person: string | null
    added_by: string | null
    owner_approved_at: string | null
    approval_status: ApprovalStatus
    campaign_status: CampaignStatus | null
    decided_by: string | null
    decided_at: string | null
    campaign_note: string | null
  }>(
    `select ch.id, ch.client_id, c.company, ch.service, ch.quantity::text, ch.rate::text, ch.total_amount::text,
            ch.gst_type, ch.charge_date::text, ch.notes, o.name as sales_person, r.name as added_by,
            to_json(ch.approved_at)#>>'{}' as owner_approved_at, ch.approval_status, ch.campaign_status, d.name as decided_by,
            to_json(ch.campaign_decided_at)#>>'{}' as decided_at, ch.campaign_note
     from public.client_charges ch
     join public.clients c on c.id = ch.client_id
     left join public.employees o on o.id = c.owner_employee_id
     left join public.employees r on r.id = ch.recorded_by_employee_id
     left join public.employees d on d.id = ch.campaign_decided_by_employee_id
     where ch.kind = 'Service' and ch.service = any($1::text[])
       and ($2 or ch.approval_status = 'Approved')
     order by case
                when ch.approval_status = 'Pending' then 0
                else 1 + coalesce(array_position(array['Pending','Approved','Running','Completed','Rejected'], ch.campaign_status), 5)
              end,
              coalesce(ch.campaign_decided_at, ch.approved_at, ch.created_at) desc
     limit 500`,
    [[...CAMPAIGN_SERVICES, ...CAMPAIGN_SERVICES.map((s) => testingServiceName(s))], includeOwnerPending]
  )
  return rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    company: r.company,
    service: r.service,
    quantity: Number(r.quantity),
    rate: Number(r.rate),
    total: Number(r.total_amount),
    gstType: r.gst_type,
    serviceDate: r.charge_date,
    notes: r.notes,
    salesPerson: r.sales_person,
    addedBy: r.added_by,
    ownerApprovedAt: r.approval_status === "Approved" ? r.owner_approved_at : null,
    ownerStatus: r.approval_status,
    status: r.campaign_status,
    decidedBy: r.decided_by,
    decidedAt: r.decided_at,
    campaignNote: r.campaign_note,
  }))
}

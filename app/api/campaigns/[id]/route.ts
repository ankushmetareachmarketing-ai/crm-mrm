import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { testedServiceOf } from "@/lib/billing"
import { CAMPAIGN_NEXT, CAMPAIGN_STATUS_LABEL, type CampaignStatus } from "@/lib/campaigns"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import { notify } from "@/lib/notifications"

const STATUSES: CampaignStatus[] = ["Pending", "Approved", "Running", "Completed", "Rejected"]

/**
 * The Campaign Manager (or the Owner) moves an Owner-approved SMS / Voice
 * campaign along: approve or reject it, start it, mark it done. The sales
 * person, the client's owner and the Owner are told each time.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  if (caller.role !== "Campaign Manager" && caller.role !== "Owner") {
    return NextResponse.json({ error: "Only the Campaign Manager can update campaigns." }, { status: 403 })
  }

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 })
  const body = (await request.json()) ?? {}
  const status = body.status as CampaignStatus
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : ""
  if (!STATUSES.includes(status)) return NextResponse.json({ error: "Status is invalid." }, { status: 400 })

  const db = await pool.connect()
  try {
    await db.query("begin")
    const { rows } = await db.query<{
      campaign_status: CampaignStatus | null
      service: string
      quantity: string
      client_id: string
      company: string
      client_owner_id: string | null
      recorded_by_id: string | null
    }>(
      `select ch.campaign_status, ch.service, ch.quantity::text, ch.client_id, c.company,
              c.owner_employee_id as client_owner_id, ch.recorded_by_employee_id as recorded_by_id
       from public.client_charges ch join public.clients c on c.id = ch.client_id
       where ch.id = $1 for update of ch`,
      [id]
    )
    const camp = rows[0]
    if (!camp || !camp.campaign_status) {
      await db.query("rollback")
      return NextResponse.json({ error: "Campaign not found, or the Owner hasn't approved it yet." }, { status: 404 })
    }
    if (!CAMPAIGN_NEXT[camp.campaign_status].includes(status)) {
      await db.query("rollback")
      return NextResponse.json(
        { error: `A campaign that is "${CAMPAIGN_STATUS_LABEL[camp.campaign_status]}" can't be moved to "${CAMPAIGN_STATUS_LABEL[status]}".` },
        { status: 400 }
      )
    }
    if (status === "Rejected" && !note) {
      await db.query("rollback")
      return NextResponse.json({ error: "Write why the campaign is rejected." }, { status: 400 })
    }

    await db.query(
      `update public.client_charges
       set campaign_status = $2, campaign_decided_by_employee_id = $3, campaign_decided_at = now(),
           campaign_note = coalesce(nullif($4, ''), campaign_note)
       where id = $1`,
      [id, status, caller.id, note]
    )
    await db.query(
      `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
       values ('client', $1, $2, $3, $4)`,
      [camp.client_id, caller.id, CAMPAIGN_STATUS_LABEL[status], `${testedServiceOf(camp.service)}${note ? ` — ${note}` : ""}`]
    )
    await notify(
      {
        employeeIds: [camp.recorded_by_id, camp.client_owner_id],
        roles: ["Owner"],
        actorId: caller.id,
        kind: "service",
        title: `${testedServiceOf(camp.service)}: ${CAMPAIGN_STATUS_LABEL[status].toLowerCase()}`,
        detail: `${camp.company} — ${caller.name} updated it${note ? `: ${note}` : "."}`,
        link: `/sales-details/${camp.client_id}`,
      },
      db
    )
    await db.query("commit")
    return NextResponse.json({ ok: true })
  } catch (error) {
    await db.query("rollback")
    logError("campaigns.update", error, { chargeId: id, callerId: caller.id })
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 })
  } finally {
    db.release()
  }
}

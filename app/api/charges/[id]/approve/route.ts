import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { ApprovalError, decideCharge } from "@/lib/data/approvals"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  if (caller.role !== "Owner") {
    return NextResponse.json({ error: "Only the Owner can approve services." }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const decision = body?.decision
  if (decision !== "Approved" && decision !== "Rejected") {
    return NextResponse.json({ error: "decision must be \"Approved\" or \"Rejected\"." }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query("begin")
    await decideCharge(client, id, caller.id, decision)
    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    if (error instanceof ApprovalError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logError("charges.approve", error, { chargeId: id, callerId: caller.id })
    return NextResponse.json({ error: "Could not process this decision. Please try again." }, { status: 500 })
  } finally {
    client.release()
  }

  return NextResponse.json({ ok: true })
}

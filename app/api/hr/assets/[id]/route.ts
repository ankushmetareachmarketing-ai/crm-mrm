import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import { ASSET_STATUSES } from "@/lib/hr/constants"
import { canManageHr, recordEmployeeHistory } from "@/lib/hr/server"

/**
 * POST { action: "assign", employeeId, notes? } — hand the asset to an employee.
 * POST { action: "return", notes? }             — take it back.
 * POST { action: "status", status }             — Under Repair / Retired / Available.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  if (!canManageHr(caller.role)) return NextResponse.json({ error: "Only HR or the Owner can do this." }, { status: 403 })

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 })
  const body = (await request.json()) ?? {}
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) || null : null

  const db = await pool.connect()
  try {
    await db.query("begin")
    const { rows } = await db.query<{ name: string; asset_tag: string; status: string; holder: string | null }>(
      `select a.name, a.asset_tag, a.status,
              (select employee_id::text from public.asset_assignments where asset_id = a.id and returned_at is null) as holder
       from public.assets a where a.id = $1 for update`,
      [id]
    )
    const asset = rows[0]
    if (!asset) {
      await db.query("rollback")
      return NextResponse.json({ error: "Not found." }, { status: 404 })
    }
    const label = `${asset.name} (${asset.asset_tag})`

    if (body.action === "assign") {
      if (!/^[0-9a-f-]{36}$/i.test(body.employeeId ?? "")) {
        await db.query("rollback")
        return NextResponse.json({ error: "Choose an employee." }, { status: 400 })
      }
      if (asset.holder || asset.status !== "Available") {
        await db.query("rollback")
        return NextResponse.json({ error: "This asset isn't available — return it first." }, { status: 400 })
      }
      await db.query(
        `insert into public.asset_assignments (asset_id, employee_id, assigned_by_employee_id, notes) values ($1, $2, $3, $4)`,
        [id, body.employeeId, caller.id, notes]
      )
      await db.query(`update public.assets set status = 'Assigned' where id = $1`, [id])
      await recordEmployeeHistory(db, [{ employeeId: body.employeeId, actorId: caller.id, action: "Asset given", after: label }])
    } else if (body.action === "return") {
      if (!asset.holder) {
        await db.query("rollback")
        return NextResponse.json({ error: "This asset isn't assigned to anyone." }, { status: 400 })
      }
      await db.query(
        `update public.asset_assignments set returned_at = now(), notes = coalesce($2, notes)
         where asset_id = $1 and returned_at is null`,
        [id, notes]
      )
      await db.query(`update public.assets set status = 'Available' where id = $1`, [id])
      await recordEmployeeHistory(db, [{ employeeId: asset.holder, actorId: caller.id, action: "Asset returned", before: label }])
    } else if (body.action === "status") {
      if (!(ASSET_STATUSES as readonly string[]).includes(body.status) || body.status === "Assigned") {
        await db.query("rollback")
        return NextResponse.json({ error: "Status is invalid." }, { status: 400 })
      }
      if (asset.holder) {
        await db.query("rollback")
        return NextResponse.json({ error: "Return the asset before changing its status." }, { status: 400 })
      }
      await db.query(`update public.assets set status = $2 where id = $1`, [id, body.status])
    } else {
      await db.query("rollback")
      return NextResponse.json({ error: "Unknown action." }, { status: 400 })
    }

    await db.query("commit")
    return NextResponse.json({ ok: true })
  } catch (error) {
    await db.query("rollback")
    logError("hr.assets", error, { assetId: id, action: body.action })
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 })
  } finally {
    db.release()
  }
}

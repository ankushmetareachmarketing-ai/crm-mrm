import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { ASSET_CATEGORIES } from "@/lib/hr/constants"
import { canManageHr } from "@/lib/hr/server"

/** Add a company asset (laptop, SIM, ID card…) to the register. */
export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  if (!canManageHr(caller.role)) return NextResponse.json({ error: "Only HR or the Owner can do this." }, { status: 403 })

  const body = (await request.json()) ?? {}
  const assetTag = typeof body.assetTag === "string" ? body.assetTag.trim() : ""
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const category = typeof body.category === "string" ? body.category : "Other"
  if (!assetTag || !name) return NextResponse.json({ error: "Asset tag and name are required." }, { status: 400 })
  if (!(ASSET_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "Category is invalid." }, { status: 400 })
  }

  try {
    const { rows } = await pool.query<{ id: string }>(
      `insert into public.assets (asset_tag, name, category, serial_number, notes)
       values ($1, $2, $3, $4, $5) returning id`,
      [assetTag, name, category, body.serialNumber?.trim() || null, body.notes?.trim() || null]
    )
    return NextResponse.json({ id: rows[0].id }, { status: 201 })
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "An asset with that tag already exists." }, { status: 400 })
    }
    throw error
  }
}

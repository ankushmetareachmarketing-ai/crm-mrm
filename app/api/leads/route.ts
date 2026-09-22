import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"

export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const body = await request.json()
  const {
    company,
    contact,
    industry,
    ownerEmployeeId,
    website,
    companySize,
    budget,
    priority,
    expectedCloseDate,
  } = body ?? {}

  if (!company || !contact) {
    return NextResponse.json({ error: "Company and contact are required." }, { status: 400 })
  }

  // Never trust an owner id sent from the browser: non-Owners can only ever
  // create records assigned to themselves.
  const resolvedOwnerId = caller.role === "Owner" ? ownerEmployeeId || caller.id : caller.id

  const { rows: countRows } = await pool.query(`select count(*)::int as count from public.leads`)
  const id = `LD-${1050 + countRows[0].count}`

  await pool.query(
    `insert into public.leads
       (id, company, contact, industry, owner_employee_id, website, company_size, budget, priority, expected_close_date)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      company,
      contact,
      industry || "Unclassified",
      resolvedOwnerId,
      website || null,
      companySize || null,
      budget || null,
      priority || "Medium",
      expectedCloseDate || null,
    ]
  )

  await pool.query(
    `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
     values ('lead', $1, $2, 'Created', 'Lead created via manual entry')`,
    [id, caller.id]
  )

  return NextResponse.json({ id }, { status: 201 })
}

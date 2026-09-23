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
    industry,
    ownerEmployeeId,
    status,
    website,
    logoUrl,
    gstin,
    companySize,
    addressLine1,
    addressLine2,
    city,
    state,
    pincode,
    country,
    description,
    renewalDate,
  } = body ?? {}

  if (!company) {
    return NextResponse.json({ error: "Company is required." }, { status: 400 })
  }

  // Never trust an owner id sent from the browser: non-Owners can only ever
  // create records assigned to themselves.
  const resolvedOwnerId = caller.role === "Owner" ? ownerEmployeeId || caller.id : caller.id

  const { rows: countRows } = await pool.query(`select count(*)::int as count from public.clients`)
  const id = `CL-${2010 + countRows[0].count}`

  await pool.query(
    `insert into public.clients
       (id, company, industry, owner_employee_id, status, website, logo_url, gstin, company_size,
        address_line1, address_line2, city, state, pincode, country, description, renewal_date)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [
      id,
      company,
      industry || "Unclassified",
      resolvedOwnerId,
      status || "Active",
      website || null,
      logoUrl || null,
      gstin || null,
      companySize || null,
      addressLine1 || null,
      addressLine2 || null,
      city || null,
      state || null,
      pincode || null,
      country || "India",
      description || null,
      renewalDate || null,
    ]
  )

  await pool.query(
    `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
     values ('client', $1, $2, 'Onboarded', 'Client record created')`,
    [id, caller.id]
  )

  return NextResponse.json({ id }, { status: 201 })
}

import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { assertOwnsOrIsOwner, ForbiddenError } from "@/lib/auth/ownership"
import { pool } from "@/lib/db"

const EDITABLE_FIELDS: Record<string, string> = {
  company: "company",
  industry: "industry",
  ownerEmployeeId: "owner_employee_id",
  status: "status",
  website: "website",
  logoUrl: "logo_url",
  gstin: "gstin",
  companySize: "company_size",
  addressLine1: "address_line1",
  addressLine2: "address_line2",
  city: "city",
  state: "state",
  pincode: "pincode",
  country: "country",
  description: "description",
  renewalDate: "renewal_date",
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { id } = await params

  const { rows: existingRows } = await pool.query<{ owner_employee_id: string | null }>(
    `select owner_employee_id from public.clients where id = $1`,
    [id]
  )
  if (existingRows.length === 0) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 })
  }

  try {
    assertOwnsOrIsOwner(caller, existingRows[0].owner_employee_id)
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  const body = await request.json()

  // Only the Owner may reassign a client to a different employee.
  if (caller.role !== "Owner") {
    delete body.ownerEmployeeId
  }

  const setClauses: string[] = []
  const values: unknown[] = []
  const changes: string[] = []

  for (const [key, column] of Object.entries(EDITABLE_FIELDS)) {
    if (key in body) {
      values.push(body[key] || null)
      setClauses.push(`${column} = $${values.length}`)
      changes.push(key)
    }
  }

  if (setClauses.length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 })
  }

  values.push(id)
  await pool.query(
    `update public.clients set ${setClauses.join(", ")}, updated_at = now() where id = $${values.length}`,
    values
  )

  await pool.query(
    `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
     values ('client', $1, $2, 'Updated', $3)`,
    [id, caller.id, `Updated: ${changes.join(", ")}`]
  )

  return NextResponse.json({ ok: true })
}

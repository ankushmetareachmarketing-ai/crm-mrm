import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { assertOwnsOrIsOwner, ForbiddenError } from "@/lib/auth/ownership"
import { pool } from "@/lib/db"

const EDITABLE_FIELDS: Record<string, string> = {
  company: "company",
  contact: "contact",
  designation: "designation",
  source: "source",
  industry: "industry",
  stage: "stage",
  ownerEmployeeId: "owner_employee_id",
  nextAction: "next_action",
  nextActionDue: "next_action_due",
  website: "website",
  companySize: "company_size",
  budget: "budget",
  priority: "priority",
  expectedCloseDate: "expected_close_date",
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { id } = await params

  const { rows: existingRows } = await pool.query<{ owner_employee_id: string | null }>(
    `select owner_employee_id from public.leads where id = $1`,
    [id]
  )
  if (existingRows.length === 0) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 })
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

  // Only the Owner may reassign a lead to a different employee.
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
    `update public.leads set ${setClauses.join(", ")}, updated_at = now() where id = $${values.length}`,
    values
  )

  await pool.query(
    `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
     values ('lead', $1, $2, 'Updated', $3)`,
    [id, caller.id, `Updated: ${changes.join(", ")}`]
  )

  return NextResponse.json({ ok: true })
}

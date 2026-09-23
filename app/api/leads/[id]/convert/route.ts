import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { assertOwnsOrIsOwner, ForbiddenError } from "@/lib/auth/ownership"
import { pool } from "@/lib/db"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { id } = await params

  const { rows: leadRows } = await pool.query<{
    company: string
    industry: string
    owner_employee_id: string | null
    website: string | null
    company_size: string | null
    converted_client_id: string | null
  }>(
    `select company, industry, owner_employee_id, website, company_size, converted_client_id
     from public.leads where id = $1`,
    [id]
  )
  const lead = leadRows[0]
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 })
  }

  try {
    assertOwnsOrIsOwner(caller, lead.owner_employee_id)
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  if (lead.converted_client_id) {
    return NextResponse.json({ error: "This lead has already been converted." }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query("begin")

    const { rows: countRows } = await client.query(`select count(*)::int as count from public.clients`)
    const clientId = `CL-${2010 + countRows[0].count}`

    await client.query(
      `insert into public.clients (id, company, industry, owner_employee_id, status, website, company_size)
       values ($1, $2, $3, $4, 'Active', $5, $6)`,
      [clientId, lead.company, lead.industry, lead.owner_employee_id, lead.website, lead.company_size]
    )

    await client.query(
      `update public.leads set stage = 'Won', converted_client_id = $1, converted_at = now(), updated_at = now()
       where id = $2`,
      [clientId, id]
    )

    await client.query(
      `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
       values ('lead', $1, $2, 'Converted', $3), ('client', $4, $2, 'Onboarded', $5)`,
      [id, caller.id, `Converted to client ${clientId}`, clientId, `Converted from lead ${id}`]
    )

    await client.query("commit")
    return NextResponse.json({ clientId }, { status: 201 })
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

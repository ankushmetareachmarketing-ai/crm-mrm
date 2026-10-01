import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { assertOwnsOrIsOwner, ForbiddenError } from "@/lib/auth/ownership"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import { notify } from "@/lib/notifications"
import { isValidDateString } from "@/lib/validate"

const EDITABLE_FIELDS: Record<string, string> = {
  company: "company",
  phone: "phone",
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

  if (body.renewalDate && !isValidDateString(body.renewalDate)) {
    return NextResponse.json({ error: "Renewal date is invalid." }, { status: 400 })
  }
  if (typeof body.phone === "string" && body.phone.trim()) {
    const normalizedPhone = body.phone.trim()
    const digits = normalizedPhone.replace(/\D/g, "")
    if (normalizedPhone.length > 30 || !/^\+?[\d\s().-]+$/.test(normalizedPhone) || digits.length < 7 || digits.length > 15) {
      return NextResponse.json({ error: "Enter a valid client phone number (7–15 digits)." }, { status: 400 })
    }
    body.phone = normalizedPhone
  }

  const setClauses: string[] = []
  const values: unknown[] = []
  const changes: string[] = []

  for (const [key, column] of Object.entries(EDITABLE_FIELDS)) {
    if (key in body) {
      values.push(key === "phone" ? (body[key]?.trim() || null) : body[key] || null)
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

  if (body.ownerEmployeeId && body.ownerEmployeeId !== existingRows[0].owner_employee_id) {
    await notify({
      employeeIds: [body.ownerEmployeeId],
      actorId: caller.id,
      kind: "client",
      title: "Client assigned to you",
      detail: `${caller.name} gave you the client ${body.company ?? id}.`,
      link: `/crm/clients/${id}`,
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { id } = await params
  const db = await pool.connect()
  try {
    await db.query("begin")
    const { rows } = await db.query<{
      company: string
      owner_employee_id: string | null
      balance: string
      has_payments: boolean
      has_charges: boolean
      has_converted_lead: boolean
    }>(
      `select c.company, c.owner_employee_id, c.balance::text,
              exists (select 1 from public.payments p where p.client_id = c.id) as has_payments,
              exists (select 1 from public.client_charges ch where ch.client_id = c.id) as has_charges,
              exists (select 1 from public.leads l where l.converted_client_id = c.id) as has_converted_lead
       from public.clients c where c.id = $1 for update of c`,
      [id]
    )
    if (rows.length === 0) {
      await db.query("rollback")
      return NextResponse.json({ error: "Client not found." }, { status: 404 })
    }

    try {
      assertOwnsOrIsOwner(caller, rows[0].owner_employee_id)
    } catch (error) {
      if (error instanceof ForbiddenError) {
        await db.query("rollback")
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      throw error
    }

    if (rows[0].has_payments || rows[0].has_charges || rows[0].has_converted_lead || Number(rows[0].balance) !== 0) {
      await db.query("rollback")
      return NextResponse.json(
        { error: "This client has financial or converted-lead history and cannot be deleted. Mark the client Inactive instead." },
        { status: 409 }
      )
    }

    await db.query(`delete from public.clients where id = $1`, [id])
    await db.query(
      `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
       values ('client', $1, $2, 'Deleted', $3)`,
      [id, caller.id, `Deleted client ${rows[0].company}`]
    )
    await db.query("commit")
    return NextResponse.json({ ok: true })
  } catch (error) {
    await db.query("rollback")
    logError("clients.delete", error, { clientId: id, callerId: caller.id })
    return NextResponse.json({ error: "Could not delete this client. Please try again." }, { status: 500 })
  } finally {
    db.release()
  }
}

import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { notify } from "@/lib/notifications"
import { isValidDateString } from "@/lib/validate"

export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const body = await request.json()
  const {
    company,
    phone,
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
  const normalizedPhone = typeof phone === "string" ? phone.trim() : ""
  const phoneDigits = normalizedPhone.replace(/\D/g, "")
  if (!normalizedPhone || normalizedPhone.length > 30 || !/^\+?[\d\s().-]+$/.test(normalizedPhone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    return NextResponse.json({ error: "Enter a valid client phone number (7–15 digits)." }, { status: 400 })
  }
  if (renewalDate && !isValidDateString(renewalDate)) {
    return NextResponse.json({ error: "Renewal date is invalid." }, { status: 400 })
  }

  // Never trust an owner id sent from the browser: non-Owners can only ever
  // create records assigned to themselves.
  const resolvedOwnerId = caller.role === "Owner" ? ownerEmployeeId || caller.id : caller.id

  const db = await pool.connect()
  let id: string
  try {
    await db.query("begin")
    await db.query("lock table public.clients in share row exclusive mode")
    const { rows } = await db.query<{ next_id: number }>(
      `select coalesce(max(substring(id from 4)::int), 2009) + 1 as next_id
       from public.clients where id ~ '^CL-[0-9]+$'`
    )
    id = `CL-${rows[0].next_id}`

    await db.query(
      `insert into public.clients
         (id, company, industry, owner_employee_id, status, website, logo_url, gstin, company_size,
          address_line1, address_line2, city, state, pincode, country, description, renewal_date, phone)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
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
        normalizedPhone,
      ]
    )

    await db.query(
      `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
       values ('client', $1, $2, 'Onboarded', 'Client record created')`,
      [id, caller.id]
    )
    await db.query("commit")
  } catch (error) {
    await db.query("rollback")
    throw error
  } finally {
    db.release()
  }

  await notify({
    employeeIds: [resolvedOwnerId],
    roles: caller.role === "Owner" ? [] : ["Owner"],
    actorId: caller.id,
    kind: "client",
    title: resolvedOwnerId === caller.id ? "New client added" : "New client assigned to you",
    detail: `${caller.name} added the client ${company}.`,
    link: `/crm/clients/${id}`,
  })

  return NextResponse.json({ id }, { status: 201 })
}

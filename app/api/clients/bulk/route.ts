import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { notify } from "@/lib/notifications"
import { logError } from "@/lib/logger"
import { isValidDateString } from "@/lib/validate"
import type { ClientStatus } from "@/lib/types"

interface IncomingClient {
  company?: unknown
  phone?: unknown
  industry?: unknown
  owner?: unknown
  status?: unknown
  website?: unknown
  gstin?: unknown
  companySize?: unknown
  addressLine1?: unknown
  addressLine2?: unknown
  city?: unknown
  state?: unknown
  pincode?: unknown
  country?: unknown
  description?: unknown
  renewalDate?: unknown
}

interface ValidClient {
  company: string
  phone: string
  industry: string
  ownerEmployeeId: string
  ownerName: string
  status: ClientStatus
  website: string | null
  gstin: string | null
  companySize: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  pincode: string | null
  country: string
  description: string | null
  renewalDate: string | null
}

const MAX_IMPORT_ROWS = 500
const STATUSES = new Map<string, ClientStatus>([
  ["active", "Active"],
  ["on hold", "On Hold"],
  ["inactive", "Inactive"],
])

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function optionalString(value: unknown) {
  return stringValue(value) || null
}

function validateRow(
  row: IncomingClient,
  caller: { id: string; name: string; role: string },
  employees: { id: string; name: string }[]
): { value?: ValidClient; errors: string[] } {
  const errors: string[] = []
  const company = stringValue(row.company)
  const phone = stringValue(row.phone)
  const statusValue = stringValue(row.status)
  const requestedOwner = stringValue(row.owner)
  const digits = phone.replace(/\D/g, "")
  const status = STATUSES.get(statusValue.toLowerCase())

  if (!company) errors.push("Company Name is required")
  else if (company.length > 200) errors.push("Company Name must be 200 characters or fewer")
  if (!phone || phone.length > 30 || !/^\+?[\d\s().-]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
    errors.push("Number must contain 7–15 digits")
  }
  if (!status) errors.push("Status must be Active, On Hold, or Inactive")
  const renewalDate = optionalString(row.renewalDate)
  if (renewalDate && !isValidDateString(renewalDate)) errors.push("Renewal Date must be a valid date (YYYY-MM-DD)")

  let owner = { id: caller.id, name: caller.name }
  if (requestedOwner) {
    if (caller.role !== "Owner") {
      errors.push("Only an Owner can assign clients to another employee")
    } else {
      const matches = employees.filter((employee) =>
        employee.id.toLowerCase() === requestedOwner.toLowerCase() ||
        employee.name.toLowerCase() === requestedOwner.toLowerCase()
      )
      if (matches.length !== 1) errors.push("Owner must match one active employee name or ID")
      else owner = matches[0]
    }
  }

  if (errors.length > 0) return { errors }
  return {
    errors,
    value: {
      company,
      phone,
      industry: optionalString(row.industry) ?? "Unclassified",
      ownerEmployeeId: owner.id,
      ownerName: owner.name,
      status: status!,
      website: optionalString(row.website),
      gstin: optionalString(row.gstin),
      companySize: optionalString(row.companySize),
      addressLine1: optionalString(row.addressLine1),
      addressLine2: optionalString(row.addressLine2),
      city: optionalString(row.city),
      state: optionalString(row.state),
      pincode: optionalString(row.pincode),
      country: optionalString(row.country) ?? "India",
      description: optionalString(row.description),
      renewalDate,
    },
  }
}

export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = await request.json().catch(() => null)
  const incoming = body && Array.isArray(body.clients) ? (body.clients as IncomingClient[]) : null
  if (!incoming || incoming.length === 0) {
    return NextResponse.json({ error: "Choose a file with at least one client row." }, { status: 400 })
  }
  if (incoming.length > MAX_IMPORT_ROWS) {
    return NextResponse.json({ error: `Import is limited to ${MAX_IMPORT_ROWS} clients per file.` }, { status: 400 })
  }

  const hasOwnerValues = incoming.some((row) => stringValue(row?.owner))
  const employees = caller.role === "Owner" && hasOwnerValues
    ? (await pool.query<{ id: string; name: string }>(
        `select id::text, name from public.employees where active`
      )).rows
    : []
  const errors: { row: number; messages: string[] }[] = []
  const clients = incoming.map((row, index) => {
    const result = validateRow(row ?? {}, caller, employees)
    if (result.errors.length > 0) errors.push({ row: index + 2, messages: result.errors })
    return result.value
  })
  if (errors.length > 0) {
    return NextResponse.json({ error: "Fix the listed rows before importing.", errors }, { status: 400 })
  }

  const validClients = clients as ValidClient[]
  const db = await pool.connect()
  try {
    await db.query("begin")
    await db.query("lock table public.clients in share row exclusive mode")
    const { rows } = await db.query<{ next_id: number }>(
      `select coalesce(max(substring(id from 4)::int), 2009) + 1 as next_id
       from public.clients where id ~ '^CL-[0-9]+$'`
    )
    const firstId = rows[0].next_id
    const created = validClients.map((client, index) => ({
      id: `CL-${firstId + index}`,
      ...client,
    }))

    await db.query(
      `insert into public.clients
         (id, company, phone, industry, owner_employee_id, status, website, gstin, company_size,
          address_line1, address_line2, city, state, pincode, country, description, renewal_date)
       select * from unnest(
         $1::text[], $2::text[], $3::text[], $4::text[], $5::uuid[], $6::text[], $7::text[], $8::text[],
         $9::text[], $10::text[], $11::text[], $12::text[], $13::text[], $14::text[], $15::text[], $16::text[], $17::date[]
       )`,
      [
        created.map((client) => client.id),
        created.map((client) => client.company),
        created.map((client) => client.phone),
        created.map((client) => client.industry),
        created.map((client) => client.ownerEmployeeId),
        created.map((client) => client.status),
        created.map((client) => client.website),
        created.map((client) => client.gstin),
        created.map((client) => client.companySize),
        created.map((client) => client.addressLine1),
        created.map((client) => client.addressLine2),
        created.map((client) => client.city),
        created.map((client) => client.state),
        created.map((client) => client.pincode),
        created.map((client) => client.country),
        created.map((client) => client.description),
        created.map((client) => client.renewalDate),
      ]
    )
    await db.query(
      `insert into public.activity_log (entity_type, entity_id, actor_employee_id, action, detail)
       select 'client', imported.id, $2, 'Onboarded', 'Client record created via bulk import'
       from unnest($1::text[]) as imported(id)`,
      [created.map((client) => client.id), caller.id]
    )
    await notify({
      roles: caller.role === "Owner" ? [] : ["Owner"],
      actorId: caller.id,
      kind: "client",
      title: "Clients imported",
      detail: `${caller.name} imported ${created.length} clients.`,
      link: "/crm/clients",
    }, db)
    await db.query("commit")

    return NextResponse.json({ clients: created }, { status: 201 })
  } catch (error) {
    await db.query("rollback")
    logError("clients.bulkCreate", error, { callerId: caller.id, count: validClients.length })
    return NextResponse.json({ error: "Could not import clients. Please try again." }, { status: 500 })
  } finally {
    db.release()
  }
}
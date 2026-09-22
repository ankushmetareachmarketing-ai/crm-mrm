import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  if (caller.role !== "Owner" && caller.role !== "HR") {
    return NextResponse.json({ error: "Only Owner or HR can edit employee records." }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { salary, department, address, dateOfBirth, emergencyContactName, emergencyContactPhone, active } = body ?? {}

  const fields: string[] = []
  const values: unknown[] = []
  let i = 1

  if (salary !== undefined) {
    fields.push(`salary = $${i++}`)
    values.push(salary === null || salary === "" ? null : Number(salary))
  }
  if (department !== undefined) {
    fields.push(`department = $${i++}`)
    values.push(department || null)
  }
  if (address !== undefined) {
    fields.push(`address = $${i++}`)
    values.push(address || null)
  }
  if (dateOfBirth !== undefined) {
    fields.push(`date_of_birth = $${i++}`)
    values.push(dateOfBirth || null)
  }
  if (emergencyContactName !== undefined) {
    fields.push(`emergency_contact_name = $${i++}`)
    values.push(emergencyContactName || null)
  }
  if (emergencyContactPhone !== undefined) {
    fields.push(`emergency_contact_phone = $${i++}`)
    values.push(emergencyContactPhone || null)
  }
  if (active !== undefined) {
    fields.push(`active = $${i++}`)
    values.push(Boolean(active))
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
  }

  values.push(id)
  await pool.query(`update public.employees set ${fields.join(", ")} where id = $${i}`, values)

  return NextResponse.json({ ok: true })
}

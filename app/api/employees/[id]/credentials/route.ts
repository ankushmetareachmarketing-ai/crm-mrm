import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { encryptSecret } from "@/lib/crypto"
import { logError } from "@/lib/logger"

function canManage(role: string) {
  return role === "Owner" || role === "HR"
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  if (!canManage(caller.role)) {
    return NextResponse.json({ error: "Only Owner or HR can manage credentials." }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const label = body?.label?.trim()
  const value = body?.value ?? ""

  if (!label || !value) {
    return NextResponse.json({ error: "Label and value are required." }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query("begin")

    const { rows } = await client.query<{ id: string; updated_at: string }>(
      `insert into public.employee_credentials
         (employee_id, label, value_encrypted, created_by_employee_id, updated_by_employee_id)
       values ($1, $2, $3, $4, $4)
       returning id, updated_at::text`,
      [id, label, encryptSecret(value), caller.id]
    )
    const credential = rows[0]

    await client.query(
      `insert into public.employee_credential_history
         (credential_id, employee_id, label, action, previous_value_encrypted, changed_by_employee_id)
       values ($1, $2, $3, 'Created', null, $4)`,
      [credential.id, id, label, caller.id]
    )

    await client.query("commit")
    return NextResponse.json(
      { id: credential.id, label, value, updatedBy: caller.name, updatedAt: credential.updated_at },
      { status: 201 }
    )
  } catch (error) {
    await client.query("rollback")
    logError("employees.credentials.create", error, { employeeId: id, callerId: caller.id })
    return NextResponse.json({ error: "Could not save this credential. Please try again." }, { status: 500 })
  } finally {
    client.release()
  }
}

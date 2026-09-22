import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { encryptSecret } from "@/lib/crypto"

function canManage(role: string) {
  return role === "Owner" || role === "HR"
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; credentialId: string }> }
) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  if (!canManage(caller.role)) {
    return NextResponse.json({ error: "Only Owner or HR can manage credentials." }, { status: 403 })
  }

  const { id, credentialId } = await params
  const body = await request.json()
  const label = body?.label?.trim()
  const value = body?.value ?? ""

  if (!label || !value) {
    return NextResponse.json({ error: "Label and value are required." }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query("begin")

    const { rows } = await client.query<{ value_encrypted: string }>(
      `select value_encrypted from public.employee_credentials where id = $1 and employee_id = $2 for update`,
      [credentialId, id]
    )
    if (rows.length === 0) {
      await client.query("rollback")
      return NextResponse.json({ error: "Credential not found." }, { status: 404 })
    }

    await client.query(
      `insert into public.employee_credential_history
         (credential_id, employee_id, label, action, previous_value_encrypted, changed_by_employee_id)
       values ($1, $2, $3, 'Updated', $4, $5)`,
      [credentialId, id, label, rows[0].value_encrypted, caller.id]
    )

    const { rows: updatedRows } = await client.query<{ updated_at: string }>(
      `update public.employee_credentials
       set label = $1, value_encrypted = $2, updated_by_employee_id = $3, updated_at = now()
       where id = $4
       returning updated_at::text`,
      [label, encryptSecret(value), caller.id, credentialId]
    )

    await client.query("commit")
    return NextResponse.json({
      id: credentialId,
      label,
      value,
      updatedBy: caller.name,
      updatedAt: updatedRows[0].updated_at,
    })
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; credentialId: string }> }
) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  if (!canManage(caller.role)) {
    return NextResponse.json({ error: "Only Owner or HR can manage credentials." }, { status: 403 })
  }

  const { id, credentialId } = await params

  const client = await pool.connect()
  try {
    await client.query("begin")

    const { rows } = await client.query<{ label: string; value_encrypted: string }>(
      `select label, value_encrypted from public.employee_credentials where id = $1 and employee_id = $2 for update`,
      [credentialId, id]
    )
    if (rows.length === 0) {
      await client.query("rollback")
      return NextResponse.json({ error: "Credential not found." }, { status: 404 })
    }

    await client.query(
      `insert into public.employee_credential_history
         (credential_id, employee_id, label, action, previous_value_encrypted, changed_by_employee_id)
       values ($1, $2, $3, 'Deleted', $4, $5)`,
      [credentialId, id, rows[0].label, rows[0].value_encrypted, caller.id]
    )

    await client.query(`delete from public.employee_credentials where id = $1`, [credentialId])

    await client.query("commit")
    return NextResponse.json({ ok: true })
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

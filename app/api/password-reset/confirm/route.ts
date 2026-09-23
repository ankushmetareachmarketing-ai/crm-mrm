import { NextResponse } from "next/server"
import { pool } from "@/lib/db"
import { hashResetToken } from "@/lib/auth/reset-token"
import { hashPassword } from "@/lib/auth/password"
import { logError } from "@/lib/logger"

export async function POST(request: Request) {
  const body = await request.json()
  const token = String(body?.token ?? "")
  const password = String(body?.password ?? "")

  if (!token || !password) {
    return NextResponse.json({ error: "Missing token or password." }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
  }

  const tokenHash = hashResetToken(token)
  const { rows } = await pool.query(
    `select id, employee_id from public.password_reset_tokens
     where token_hash = $1 and used_at is null and expires_at > now()`,
    [tokenHash]
  )
  const resetRequest = rows[0]

  if (!resetRequest) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)

  const client = await pool.connect()
  try {
    await client.query("begin")
    await client.query(`update public.employees set password_hash = $1 where id = $2`, [
      passwordHash,
      resetRequest.employee_id,
    ])
    await client.query(`update public.password_reset_tokens set used_at = now() where id = $1`, [
      resetRequest.id,
    ])
    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    logError("password-reset.confirm", error, { employeeId: resetRequest.employee_id })
    return NextResponse.json({ error: "Could not reset your password. Please try again." }, { status: 500 })
  } finally {
    client.release()
  }

  return NextResponse.json({ ok: true })
}

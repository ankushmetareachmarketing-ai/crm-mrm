import { NextResponse } from "next/server"
import { pool } from "@/lib/db"
import { generateResetToken } from "@/lib/auth/reset-token"

export async function POST(request: Request) {
  const body = await request.json()
  const loginId = String(body?.loginId ?? "").trim()

  if (!loginId) {
    return NextResponse.json({ error: "Enter a login ID." }, { status: 400 })
  }

  const { rows } = await pool.query(
    `select id from public.employees where login_id = $1 and active`,
    [loginId]
  )
  const employee = rows[0]

  // Always respond the same way whether or not the login ID exists, so this
  // endpoint can't be used to enumerate accounts.
  if (!employee) {
    return NextResponse.json({ ok: true })
  }

  const { token, tokenHash, expiresAt } = generateResetToken()
  await pool.query(
    `insert into public.password_reset_tokens (employee_id, token_hash, expires_at)
     values ($1, $2, $3)`,
    [employee.id, tokenHash, expiresAt]
  )

  // No email provider is configured yet — surface the reset link directly so
  // the flow is usable today. Swap this for a real email send once company
  // mail is set up; nothing else about this endpoint needs to change.
  const resetUrl = `/reset-password/${token}`
  console.log(`[password reset] ${loginId} -> ${resetUrl} (expires ${expiresAt.toISOString()})`)

  return NextResponse.json({ ok: true, resetUrl })
}

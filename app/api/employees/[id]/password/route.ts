import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { decryptSecret } from "@/lib/crypto"
import { pool } from "@/lib/db"
import { storePasswordInVault } from "@/lib/hr/password-vault"
import { canManageHr, recordEmployeeHistory } from "@/lib/hr/server"
import { notify } from "@/lib/notifications"

/**
 * Change a password.
 * - An employee changes their own: must give their current password.
 * - Owner / HR reset someone else's without it (only the Owner can reset the Owner's).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Employee not found." }, { status: 404 })

  const body = (await request.json()) ?? {}
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""
  if (newPassword.length < 6) return NextResponse.json({ error: "New password must be at least 6 characters." }, { status: 400 })
  if (newPassword.length > 200) return NextResponse.json({ error: "New password is too long." }, { status: 400 })

  const { rows } = await pool.query<{ name: string; password_hash: string; role: string }>(
    `select e.name, e.password_hash, p.name as role
     from public.employees e join public.access_profiles p on p.id = e.access_profile_id
     where e.id = $1`,
    [id]
  )
  const target = rows[0]
  if (!target) return NextResponse.json({ error: "Employee not found." }, { status: 404 })

  const isSelf = caller.id === id
  if (isSelf) {
    const current = typeof body.currentPassword === "string" ? body.currentPassword : ""
    if (!current || !(await verifyPassword(current, target.password_hash))) {
      return NextResponse.json({ error: "Your current password is not correct." }, { status: 400 })
    }
  } else {
    if (!canManageHr(caller.role)) {
      return NextResponse.json({ error: "Only HR or the Owner can reset someone's password." }, { status: 403 })
    }
    if (target.role === "Owner" && caller.role !== "Owner") {
      return NextResponse.json({ error: "Only the Owner can reset the Owner's password." }, { status: 403 })
    }
  }

  await pool.query(
    `update public.employees
     set password_hash = $2, failed_login_attempts = 0, locked_until = null
     where id = $1`,
    [id, await hashPassword(newPassword)]
  )
  await storePasswordInVault(pool, id, newPassword, caller.id)
  await recordEmployeeHistory(pool, [
    { employeeId: id, actorId: caller.id, action: isSelf ? "Password changed" : "Password reset", field: "Login" },
  ])
  if (!isSelf) {
    await notify({
      employeeIds: [id],
      actorId: caller.id,
      kind: "employee",
      title: "Your password was reset",
      detail: `${caller.name} set a new password for your login. Ask them for it, then change it from My profile.`,
      link: "/me",
    })
  }
  return NextResponse.json({ ok: true })
}

/**
 * Owner only: the employee's current password and the ones before it, from
 * the encrypted password vault. Every look is recorded in their history.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  if (caller.role !== "Owner") return NextResponse.json({ error: "Only the Owner can see passwords." }, { status: 403 })

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Employee not found." }, { status: 404 })

  const { rows } = await pool.query<{ value_encrypted: string; set_at: string; set_by: string | null }>(
    `select v.value_encrypted, to_json(v.set_at)#>>'{}' as set_at, s.name as set_by
     from public.employee_password_vault v
     left join public.employees s on s.id = v.set_by_employee_id
     where v.employee_id = $1
     order by v.set_at desc
     limit 20`,
    [id]
  )

  const passwords = rows.map((r, i) => {
    let value: string | null = null
    try {
      value = decryptSecret(r.value_encrypted)
    } catch {
      value = null
    }
    return { value, setAt: r.set_at, setBy: r.set_by, current: i === 0 }
  })

  if (!isSelfView(caller.id, id)) {
    await recordEmployeeHistory(pool, [{ employeeId: id, actorId: caller.id, action: "Password viewed", field: "Login" }])
  }
  return NextResponse.json({ passwords }, { headers: { "Cache-Control": "no-store" } })
}

function isSelfView(callerId: string, employeeId: string) {
  return callerId === employeeId
}

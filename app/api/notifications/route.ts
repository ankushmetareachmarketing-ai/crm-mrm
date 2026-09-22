import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"

export async function GET() {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { rows } = await pool.query(
    `select id, title, detail, created_at, read_at
     from public.notifications
     order by created_at desc
     limit 20`
  )

  return NextResponse.json({ notifications: rows })
}

export async function PATCH() {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  await pool.query(`update public.notifications set read_at = now() where read_at is null`)

  return NextResponse.json({ ok: true })
}

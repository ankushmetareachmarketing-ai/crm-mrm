import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"

/** Marks one of the caller's own notifications as read (when it is clicked). */
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Notification not found." }, { status: 404 })
  }

  await pool.query(
    `update public.notifications set read_at = coalesce(read_at, now())
     where id = $1 and recipient_employee_id = $2`,
    [id, caller.id]
  )

  return NextResponse.json({ ok: true })
}

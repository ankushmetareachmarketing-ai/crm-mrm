import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"

/** The signed-in employee's latest notifications and their unread count. Polled by the header bell. */
export async function GET() {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const [listResult, countResult] = await Promise.all([
    pool.query(
      `select n.id, n.title, n.detail, n.kind, n.link, to_json(n.created_at)#>>'{}' as created_at,
              to_json(n.read_at)#>>'{}' as read_at, a.name as actor_name
       from public.notifications n
       left join public.employees a on a.id = n.actor_employee_id
       where n.recipient_employee_id = $1
       order by n.created_at desc
       limit 30`,
      [caller.id]
    ),
    pool.query<{ unread: number }>(
      `select count(*)::int as unread from public.notifications
       where recipient_employee_id = $1 and read_at is null`,
      [caller.id]
    ),
  ])

  return NextResponse.json(
    { notifications: listResult.rows, unread: countResult.rows[0].unread },
    { headers: { "Cache-Control": "no-store" } }
  )
}

/** Marks all of the caller's notifications as read. */
export async function PATCH() {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  await pool.query(
    `update public.notifications set read_at = now() where recipient_employee_id = $1 and read_at is null`,
    [caller.id]
  )

  return NextResponse.json({ ok: true })
}

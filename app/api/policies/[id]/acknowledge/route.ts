import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { recordEmployeeHistory } from "@/lib/hr/server"

/** The signed-in employee confirms they have read an active policy. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 })

  const { rows } = await pool.query<{ title: string; inserted: boolean }>(
    `with p as (select id, title from public.policies where id = $1 and active),
          ins as (
            insert into public.policy_acknowledgements (policy_id, employee_id)
            select id, $2 from p
            on conflict do nothing
            returning 1
          )
     select p.title, exists (select 1 from ins) as inserted from p`,
    [id, caller.id]
  )
  if (!rows[0]) return NextResponse.json({ error: "Policy not found." }, { status: 404 })
  if (rows[0].inserted) {
    await recordEmployeeHistory(pool, [
      { employeeId: caller.id, actorId: caller.id, action: "Policy accepted", after: rows[0].title },
    ])
  }
  return NextResponse.json({ ok: true })
}

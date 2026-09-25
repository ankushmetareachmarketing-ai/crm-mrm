import "server-only"
import type { Pool, PoolClient } from "pg"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import type { Role } from "@/lib/types"

export type NotificationKind = "service" | "payment" | "approval" | "lead" | "client" | "employee"

interface NotifyInput {
  /** Everyone active in these roles… */
  roles?: Role[]
  /** …and/or these specific employees. */
  employeeIds?: (string | null | undefined)[]
  /** The person who caused it — never notified about their own action. */
  actorId: string
  kind: NotificationKind
  title: string
  detail: string
  /** Page the notification opens when clicked. */
  link: string
}

/**
 * Sends one personal notification to each recipient. Pass the open
 * transaction's client so the notification commits (or rolls back) with the
 * change it describes; without one it runs standalone and a failure is only
 * logged, since a missed notification must never fail the real action.
 */
export async function notify(input: NotifyInput, db?: PoolClient) {
  const employeeIds = (input.employeeIds ?? []).filter((id): id is string => Boolean(id))
  const roles = input.roles ?? []
  if (employeeIds.length === 0 && roles.length === 0) return

  const run = (conn: Pool | PoolClient) =>
    conn.query(
      `insert into public.notifications (recipient_employee_id, actor_employee_id, kind, title, detail, link)
       select e.id, $1, $2, $3, $4, $5
       from public.employees e
       join public.access_profiles p on p.id = e.access_profile_id
       where e.active and e.id <> $1 and (e.id = any($6::uuid[]) or p.name = any($7::text[]))`,
      [input.actorId, input.kind, input.title, input.detail, input.link, employeeIds, roles]
    )

  if (db) {
    await run(db)
    return
  }
  try {
    await run(pool)
  } catch (error) {
    logError("notifications.notify", error, { kind: input.kind, link: input.link })
  }
}

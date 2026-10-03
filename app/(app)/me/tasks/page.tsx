import { redirect } from "next/navigation"
import { pool } from "@/lib/db"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import { getMyTasks } from "@/lib/data/me"
import { canManageHr } from "@/lib/hr/server"
import { MyTasksClient } from "./my-tasks-client"

export default async function MyTasksPage() {
  const me = await getCurrentEmployee()
  // The Owner manages everyone from the HR pages; self-service is for staff.
  if (me.role === "Owner") redirect("/me")
  const [tasks, team] = await Promise.all([
    getMyTasks(me.id),
    // HR / Owner can give tasks to anyone; a manager to their own reports.
    pool.query<{ id: string; name: string }>(
      canManageHr(me.role)
        ? `select id, name from public.employees where active and id <> $1 order by name`
        : `select id, name from public.employees where active and reporting_manager_id = $1 order by name`,
      [me.id]
    ),
  ])
  return <MyTasksClient mine={tasks.mine} given={tasks.given} team={team.rows} />
}

import "server-only"
import type { PoolClient } from "pg"

/** Copies the active onboarding checklist template onto a new employee (once). */
export async function createOnboardingTasks(db: PoolClient, employeeId: string) {
  await db.query(
    `insert into public.employee_onboarding_tasks (employee_id, title, category, sort_order)
     select $1, t.title, t.category, t.sort_order
     from public.onboarding_templates t
     where t.active
       and not exists (select 1 from public.employee_onboarding_tasks x where x.employee_id = $1)
     order by t.sort_order`,
    [employeeId]
  )
}

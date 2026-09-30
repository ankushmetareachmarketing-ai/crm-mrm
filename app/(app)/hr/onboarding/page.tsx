import { pool } from "@/lib/db"
import { getEmployeeDirectory, getPolicies } from "@/lib/data/hr"
import { requireHrManager } from "@/lib/hr/server"
import { OnboardingClient } from "./onboarding-client"

export default async function OnboardingPage() {
  const me = await requireHrManager()
  const [employees, policies, progress, activeCount] = await Promise.all([
    getEmployeeDirectory(),
    getPolicies(me.id, true),
    pool.query<{ employee_id: string; total: number; done: number }>(
      `select employee_id, count(*)::int as total, count(done_at)::int as done
       from public.employee_onboarding_tasks group by employee_id`
    ),
    pool.query<{ n: number }>(`select count(*)::int as n from public.employees where active`),
  ])
  const byEmployee = Object.fromEntries(progress.rows.map((r) => [r.employee_id, { total: r.total, done: r.done }]))
  const joiners = employees
    .filter((e) => e.status === "Onboarding" || e.status === "Probation")
    .map((e) => ({ ...e, progress: byEmployee[e.id] ?? { total: 0, done: 0 } }))

  return <OnboardingClient joiners={joiners} policies={policies} activeEmployees={activeCount.rows[0].n} />
}

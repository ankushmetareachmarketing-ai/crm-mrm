import { pool } from "@/lib/db"
import type { Lead } from "@/lib/types"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import { LeadsClient } from "./leads-client"

interface LeadRow {
  id: string
  company: string
  contact: string
  designation: string
  source: string
  industry: string
  stage: Lead["stage"]
  owner_employee_id: string | null
  owner_name: string | null
  next_action: string | null
  next_action_due: string | null
  created_at: string
  website: string | null
  company_size: string | null
  budget: string | null
  priority: Lead["priority"]
  expected_close_date: string | null
  converted_client_id: string | null
}

export default async function LeadsPage() {
  const currentEmployee = await getCurrentEmployee()
  const isOwner = currentEmployee.role === "Owner"

  const [leadsResult, employeesResult] = await Promise.all([
    pool.query<LeadRow>(
      `select l.id, l.company, l.contact, l.designation, l.source, l.industry, l.stage,
              l.owner_employee_id, e.name as owner_name,
              l.next_action, l.next_action_due::text, l.created_at::text,
              l.website, l.company_size, l.budget::text, l.priority, l.expected_close_date::text,
              l.converted_client_id
       from public.leads l
       left join public.employees e on e.id = l.owner_employee_id
       ${isOwner ? "" : "where l.owner_employee_id = $1"}
       order by l.created_at desc`,
      isOwner ? [] : [currentEmployee.id]
    ),
    pool.query<{ id: string; name: string }>(
      `select id, name from public.employees where active order by name`
    ),
  ])

  const leads: Lead[] = leadsResult.rows.map((l) => ({
    id: l.id,
    company: l.company,
    contact: l.contact,
    designation: l.designation,
    source: l.source,
    industry: l.industry,
    stage: l.stage,
    owner: l.owner_name ?? "—",
    ownerEmployeeId: l.owner_employee_id,
    nextAction: l.next_action ?? "—",
    nextActionDue: l.next_action_due ?? "—",
    createdAt: l.created_at,
    website: l.website,
    companySize: l.company_size,
    budget: l.budget ? Number(l.budget) : null,
    priority: l.priority,
    expectedCloseDate: l.expected_close_date,
    convertedClientId: l.converted_client_id,
  }))

  return (
    <LeadsClient
      initialLeads={leads}
      employees={employeesResult.rows}
      currentEmployeeId={currentEmployee.id}
      isOwner={isOwner}
    />
  )
}

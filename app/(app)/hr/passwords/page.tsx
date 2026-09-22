import { notFound } from "next/navigation"
import { pool } from "@/lib/db"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import { decryptSecret } from "@/lib/crypto"
import { PasswordManagerClient } from "./password-manager-client"

export default async function PasswordManagerPage() {
  const currentEmployee = await getCurrentEmployee()
  if (currentEmployee.role !== "Owner" && currentEmployee.role !== "HR") {
    notFound()
  }

  const [credentialsResult, employeesResult] = await Promise.all([
    pool.query<{
      id: string
      employee_id: string
      employee_name: string
      label: string
      value_encrypted: string
      updated_at: string
      updated_by_name: string | null
    }>(
      `select c.id, c.employee_id, emp.name as employee_name, c.label, c.value_encrypted,
              c.updated_at::text, u.name as updated_by_name
       from public.employee_credentials c
       join public.employees emp on emp.id = c.employee_id
       left join public.employees u on u.id = c.updated_by_employee_id
       order by emp.name, c.created_at`
    ),
    pool.query<{ id: string; name: string }>(`select id, name from public.employees order by name`),
  ])

  const credentials = credentialsResult.rows.map((c) => ({
    id: c.id,
    employeeId: c.employee_id,
    employeeName: c.employee_name,
    label: c.label,
    value: decryptSecret(c.value_encrypted),
    updatedAt: c.updated_at,
    updatedBy: c.updated_by_name,
  }))

  return <PasswordManagerClient credentials={credentials} employees={employeesResult.rows} />
}

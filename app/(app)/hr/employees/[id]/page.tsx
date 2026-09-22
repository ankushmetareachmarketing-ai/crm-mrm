import { notFound } from "next/navigation"
import { pool } from "@/lib/db"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import { decryptSecret } from "@/lib/crypto"
import type { Employee, EmployeeCredential, CredentialHistoryEntry } from "@/lib/types"
import { EmployeeDetailClient } from "./employee-detail-client"

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const currentEmployee = await getCurrentEmployee()
  if (currentEmployee.role !== "Owner" && currentEmployee.role !== "HR") {
    notFound()
  }

  const [employeeResult, credentialsResult, historyResult] = await Promise.all([
    pool.query<{
      id: string
      name: string
      contact: string
      login_id: string
      employment_type: Employee["employmentType"]
      joining_date: string
      active: boolean
      profile_name: string
      photo_url: string | null
      date_of_birth: string | null
      address: string | null
      department: string | null
      emergency_contact_name: string | null
      emergency_contact_phone: string | null
      salary: string | null
    }>(
      `select e.id, e.name, e.contact, e.login_id, e.employment_type, e.joining_date::text, e.active,
              p.name as profile_name, e.photo_url, e.date_of_birth::text, e.address, e.department,
              e.emergency_contact_name, e.emergency_contact_phone, e.salary::text
       from public.employees e
       join public.access_profiles p on p.id = e.access_profile_id
       where e.id = $1`,
      [id]
    ),
    pool.query<{ id: string; label: string; value_encrypted: string; updated_at: string; updated_by_name: string | null }>(
      `select c.id, c.label, c.value_encrypted, c.updated_at::text, u.name as updated_by_name
       from public.employee_credentials c
       left join public.employees u on u.id = c.updated_by_employee_id
       where c.employee_id = $1
       order by c.created_at`,
      [id]
    ),
    pool.query<{ id: string; label: string; action: CredentialHistoryEntry["action"]; changed_at: string; changed_by_name: string | null }>(
      `select h.id, h.label, h.action, h.changed_at::text, e.name as changed_by_name
       from public.employee_credential_history h
       left join public.employees e on e.id = h.changed_by_employee_id
       where h.employee_id = $1
       order by h.changed_at desc
       limit 100`,
      [id]
    ),
  ])

  if (employeeResult.rows.length === 0) {
    notFound()
  }
  const row = employeeResult.rows[0]

  const employee: Employee = {
    id: row.id,
    name: row.name,
    contact: row.contact,
    joiningDate: row.joining_date,
    employmentType: row.employment_type,
    profile: row.profile_name,
    active: row.active,
    loginId: row.login_id,
    photoUrl: row.photo_url,
    dateOfBirth: row.date_of_birth,
    address: row.address,
    department: row.department,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    salary: row.salary ? Number(row.salary) : null,
  }

  const credentials: EmployeeCredential[] = credentialsResult.rows.map((c) => ({
    id: c.id,
    label: c.label,
    value: decryptSecret(c.value_encrypted),
    updatedBy: c.updated_by_name,
    updatedAt: c.updated_at,
  }))

  const history: CredentialHistoryEntry[] = historyResult.rows.map((h) => ({
    id: h.id,
    label: h.label,
    action: h.action,
    changedBy: h.changed_by_name,
    changedAt: h.changed_at,
  }))

  return <EmployeeDetailClient employee={employee} credentials={credentials} history={history} />
}

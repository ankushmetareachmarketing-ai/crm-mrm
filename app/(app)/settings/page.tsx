import { pool } from "@/lib/db"
import { serviceCatalogue as initialServices } from "@/lib/mock-data"
import type { Employee, Profile } from "@/lib/types"
import { SettingsClient } from "./settings-client"

interface EmployeeRow {
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
}

interface ProfileRow {
  id: string
  name: string
  description: string
  data_scope: string
}

export default async function SettingsPage() {
  const [profileResult, employeeResult] = await Promise.all([
    pool.query<ProfileRow>(
      `select id, name, description, data_scope from public.access_profiles order by created_at`
    ),
    pool.query<EmployeeRow>(
      `select e.id, e.name, e.contact, e.login_id, e.employment_type, e.joining_date::text, e.active,
              p.name as profile_name, e.photo_url, e.date_of_birth::text, e.address, e.department,
              e.emergency_contact_name, e.emergency_contact_phone, e.salary::text
       from public.employees e
       join public.access_profiles p on p.id = e.access_profile_id
       order by e.created_at desc`
    ),
  ])

  const employees: Employee[] = employeeResult.rows.map((e) => ({
    id: e.id,
    name: e.name,
    contact: e.contact,
    joiningDate: e.joining_date,
    employmentType: e.employment_type,
    profile: e.profile_name,
    active: e.active,
    loginId: e.login_id,
    photoUrl: e.photo_url,
    dateOfBirth: e.date_of_birth,
    address: e.address,
    department: e.department,
    emergencyContactName: e.emergency_contact_name,
    emergencyContactPhone: e.emergency_contact_phone,
    salary: e.salary ? Number(e.salary) : null,
  }))

  const profiles: Profile[] = profileResult.rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    dataScope: p.data_scope,
    employeeCount: employees.filter((e) => e.profile === p.name).length,
  }))

  return (
    <SettingsClient
      initialProfiles={profiles}
      initialEmployees={employees}
      initialServices={initialServices}
    />
  )
}

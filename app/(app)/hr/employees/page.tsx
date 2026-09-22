import { notFound } from "next/navigation"
import { pool } from "@/lib/db"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import type { Employee } from "@/lib/types"
import { EmployeesClient } from "./employees-client"

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
  department: string | null
  salary: string | null
  date_of_birth: string | null
  address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
}

export default async function EmployeesPage() {
  const currentEmployee = await getCurrentEmployee()
  if (currentEmployee.role !== "Owner" && currentEmployee.role !== "HR") {
    notFound()
  }

  const { rows } = await pool.query<EmployeeRow>(
    `select e.id, e.name, e.contact, e.login_id, e.employment_type, e.joining_date::text, e.active,
            p.name as profile_name, e.photo_url, e.department, e.salary::text, e.date_of_birth::text,
            e.address, e.emergency_contact_name, e.emergency_contact_phone
     from public.employees e
     join public.access_profiles p on p.id = e.access_profile_id
     order by e.created_at desc`
  )

  const employees: Employee[] = rows.map((e) => ({
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

  return <EmployeesClient employees={employees} />
}

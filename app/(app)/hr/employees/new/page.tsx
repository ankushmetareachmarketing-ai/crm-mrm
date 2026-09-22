import { notFound } from "next/navigation"
import { pool } from "@/lib/db"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import { EmployeeForm } from "./employee-form"

export default async function NewEmployeePage() {
  const currentEmployee = await getCurrentEmployee()
  if (currentEmployee.role !== "Owner" && currentEmployee.role !== "HR") {
    notFound()
  }

  const { rows } = await pool.query<{ id: string; name: string }>(
    `select id, name from public.access_profiles order by name`
  )

  return <EmployeeForm profiles={rows} />
}

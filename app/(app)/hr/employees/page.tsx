import { getEmployeeDirectory, getOrgOptions } from "@/lib/data/hr"
import { requireHrManager } from "@/lib/hr/server"
import { EmployeesClient } from "./employees-client"

export default async function EmployeesPage() {
  await requireHrManager()
  const [employees, org] = await Promise.all([getEmployeeDirectory(), getOrgOptions()])
  return <EmployeesClient employees={employees} org={org} />
}

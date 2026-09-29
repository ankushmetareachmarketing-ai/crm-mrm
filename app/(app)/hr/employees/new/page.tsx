import { getOrgOptions } from "@/lib/data/hr"
import { requireHrManager } from "@/lib/hr/server"
import { EmployeeForm } from "./employee-form"

export default async function NewEmployeePage() {
  const me = await requireHrManager()
  const org = await getOrgOptions()
  // Only the Owner may create another Owner.
  const roles = me.role === "Owner" ? org.roles : org.roles.filter((r) => r.name !== "Owner")
  return <EmployeeForm org={{ ...org, roles }} />
}

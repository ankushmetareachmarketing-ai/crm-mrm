import { getEmployeeDirectory, getOrgOptions } from "@/lib/data/hr"
import { requireHrManager } from "@/lib/hr/server"
import { OrganizationClient } from "./organization-client"

export default async function OrganizationPage() {
  await requireHrManager()
  const [org, employees] = await Promise.all([getOrgOptions(), getEmployeeDirectory()])
  return <OrganizationClient org={org} employees={employees} />
}

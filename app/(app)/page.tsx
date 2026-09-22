import { getCurrentEmployee } from "@/lib/auth/current-user"
import { OwnerDashboard } from "./dashboard/owner-dashboard"
import { SalesDashboard } from "./dashboard/sales-dashboard"
import { HrDashboard } from "./dashboard/hr-dashboard"

export default async function DashboardPage() {
  const currentEmployee = await getCurrentEmployee()

  if (currentEmployee.role === "Owner") {
    return <OwnerDashboard />
  }

  if (currentEmployee.role === "HR") {
    return <HrDashboard />
  }

  return <SalesDashboard employeeId={currentEmployee.id} />
}

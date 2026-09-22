import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Users,
  Building2,
  Megaphone,
  Wallet,
  Truck,
  UserCog,
  LifeBuoy,
  BarChart3,
  Settings,
  IndianRupee,
  Phone,
  LineChart,
  KeyRound,
} from "lucide-react"
import type { Role } from "@/lib/types"

export interface NavItem {
  title: string
  url: string
  icon: LucideIcon
  roles: Role[] | "all"
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: "all" },
    ],
  },
  {
    label: "CRM & Sales",
    items: [
      { title: "Leads", url: "/crm/leads", icon: Users, roles: ["Owner", "Sales"] },
      { title: "Clients", url: "/crm/clients", icon: Building2, roles: ["Owner", "Sales"] },
      { title: "Calls", url: "/calls", icon: Phone, roles: ["Owner", "Sales"] },
      { title: "Payments", url: "/payments", icon: IndianRupee, roles: ["Owner", "Sales", "HR"] },
      { title: "Sales Report", url: "/sales-report", icon: LineChart, roles: ["Owner", "Sales"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Campaigns", url: "/campaigns", icon: Megaphone, roles: ["Owner", "Sales", "Campaign Manager"] },
      { title: "Client Finance", url: "/finance", icon: Wallet, roles: ["Owner", "HR"] },
      { title: "Vendors", url: "/vendors", icon: Truck, roles: ["Owner", "Campaign Manager"] },
    ],
  },
  {
    label: "People",
    items: [
      { title: "Employees", url: "/hr/employees", icon: Users, roles: ["Owner", "HR"] },
      { title: "Attendance", url: "/hr/attendance", icon: UserCog, roles: "all" },
      { title: "Salary", url: "/hr/attendance?tab=salary", icon: IndianRupee, roles: ["Owner", "HR"] },
      { title: "Password Manager", url: "/hr/passwords", icon: KeyRound, roles: ["Owner", "HR"] },
      { title: "Support Tickets", url: "/support", icon: LifeBuoy, roles: "all" },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Reports & Audit", url: "/reports", icon: BarChart3, roles: ["Owner"] },
      { title: "Owner Configuration", url: "/settings", icon: Settings, roles: ["Owner"] },
    ],
  },
]

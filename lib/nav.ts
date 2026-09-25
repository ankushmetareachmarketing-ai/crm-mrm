import type { IconComponent } from "@/components/icons"
import {
  LayoutDashboard,
  Users,
  Building2,
  Wallet,
  UserCog,
  IndianRupee,
  Phone,
  LineChart,
  KeyRound,
  Receipt,
  Layers,
} from "@/components/icons"
import type { Role } from "@/lib/types"

export interface NavItem {
  title: string
  url: string
  icon: IconComponent
  roles: Role[] | "all"
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

// Go-live scope is Sales + Owner. HR tools stay available to the HR role
// only; modules still on mock data (campaigns, vendors, support, reports,
// settings) are switched off in lib/disabled-module.ts until they are real.
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
      { title: "Services", url: "/services", icon: Layers, roles: ["Owner", "Sales"] },
      { title: "Payments", url: "/payments", icon: IndianRupee, roles: ["Owner", "Sales", "HR"] },
      { title: "Sales Details", url: "/sales-details", icon: Receipt, roles: ["Owner", "Sales"] },
      { title: "Sales Report", url: "/sales-report", icon: LineChart, roles: ["Owner", "Sales"] },
    ],
  },
  {
    label: "Team",
    items: [
      { title: "Employees", url: "/hr/employees", icon: Users, roles: ["Owner", "HR"] },
    ],
  },
  {
    label: "HR",
    items: [
      { title: "Client Finance", url: "/finance", icon: Wallet, roles: ["HR"] },
      { title: "Attendance", url: "/hr/attendance", icon: UserCog, roles: ["HR"] },
      { title: "Salary", url: "/hr/attendance?tab=salary", icon: IndianRupee, roles: ["HR"] },
      { title: "Password Manager", url: "/hr/passwords", icon: KeyRound, roles: ["HR"] },
    ],
  },
]

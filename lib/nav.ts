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
  UserCheck,
  Clock,
  CalendarRange,
  ListChecks,
  Hierarchy,
  UserPlus,
  ShieldAlert,
  AlarmClock,
  Laptop,
  Megaphone,
} from "@/components/icons"
import type { Role } from "@/lib/types"

export interface NavItem {
  title: string
  url: string
  icon: IconComponent
  roles: Role[] | "all"
  /** Roles that never see this item even when roles is "all". */
  hiddenFor?: Role[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

// Go-live scope is Sales + Owner. HR tools are shown to the HR role (the
// Owner can still open them by URL); modules still on mock data (campaigns,
// vendors, support, reports, settings) are switched off in
// lib/disabled-module.ts until they are real. "My space" is self-service
// for everyone.
export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: "all" },
      { title: "Finance", url: "/owner-finance", icon: Wallet, roles: ["Owner"] },
      { title: "Campaigns", url: "/campaign-queue", icon: Megaphone, roles: ["Owner", "Campaign Manager"] },
    ],
  },
  {
    label: "My space",
    items: [
      { title: "My profile", url: "/me", icon: UserCheck, roles: "all" },
      { title: "My attendance", url: "/me/attendance", icon: Clock, roles: "all", hiddenFor: ["Owner"] },
      { title: "My leave", url: "/me/leave", icon: CalendarRange, roles: "all", hiddenFor: ["Owner"] },
      { title: "My tasks", url: "/me/tasks", icon: ListChecks, roles: "all", hiddenFor: ["Owner"] },
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
    label: "People",
    items: [
      { title: "Employees", url: "/hr/employees", icon: Users, roles: ["Owner", "HR"] },
      { title: "Organization", url: "/hr/organization", icon: Hierarchy, roles: ["HR"] },
      { title: "Onboarding", url: "/hr/onboarding", icon: UserPlus, roles: ["HR"] },
      { title: "Roles & permissions", url: "/hr/roles", icon: ShieldAlert, roles: ["HR"] },
    ],
  },
  {
    label: "Attendance & leave",
    items: [
      { title: "Attendance dashboard", url: "/hr/attendance-report", icon: AlarmClock, roles: ["HR"] },
      { title: "Attendance register", url: "/hr/attendance", icon: UserCog, roles: ["HR"] },
      { title: "Leave requests", url: "/hr/leave", icon: ListChecks, roles: ["HR"] },
    ],
  },
  {
    label: "HR admin",
    items: [
      { title: "Assets", url: "/hr/assets", icon: Laptop, roles: ["HR"] },
      { title: "Salary", url: "/hr/attendance?tab=salary", icon: IndianRupee, roles: ["HR"] },
      { title: "Password Manager", url: "/hr/passwords", icon: KeyRound, roles: ["HR"] },
      { title: "Client Finance", url: "/finance", icon: Wallet, roles: ["HR"] },
    ],
  },
]

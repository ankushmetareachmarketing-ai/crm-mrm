// HR option lists shared by the server (validation) and the browser (forms).
// They mirror the check constraints in 20260929000000_hr_foundation.sql.

export const EMPLOYEE_STATUSES = [
  "Onboarding",
  "Probation",
  "Active",
  "Notice Period",
  "Resigned",
  "Terminated",
  "Inactive",
] as const
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]

/** Colour for each status badge, so a glance tells where someone is. */
export const EMPLOYEE_STATUS_STYLE: Record<EmployeeStatus, string> = {
  Onboarding: "bg-violet-50 text-violet-700 border-violet-200",
  Probation: "bg-amber-50 text-amber-700 border-amber-200",
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Notice Period": "bg-orange-50 text-orange-700 border-orange-200",
  Resigned: "bg-slate-100 text-slate-600 border-slate-200",
  Terminated: "bg-rose-50 text-rose-700 border-rose-200",
  Inactive: "bg-slate-100 text-slate-600 border-slate-200",
}

export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract"] as const

export const DOCUMENT_CATEGORIES = [
  "ID Proof",
  "Address Proof",
  "Education",
  "Experience",
  "Offer Letter",
  "Contract",
  "Other",
] as const
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]

export const ONBOARDING_CATEGORIES = ["Documents", "Policies", "IT & Assets", "Introductions", "Other"] as const

export const ASSET_CATEGORIES = ["Laptop", "Desktop", "Mobile", "SIM Card", "ID Card", "Headset", "Other"] as const
export const ASSET_STATUSES = ["Available", "Assigned", "Under Repair", "Retired"] as const

export const GENDERS = ["Male", "Female", "Other", "Prefer not to say"] as const
export const MARITAL_STATUSES = ["Single", "Married", "Other"] as const
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const

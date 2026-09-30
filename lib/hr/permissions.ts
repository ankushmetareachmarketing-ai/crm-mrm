// What each role can do in the app. This mirrors the checks in the API
// routes and pages (it is documentation for the Roles & Permissions page,
// not the enforcement itself) — update it whenever a rule changes.

export type Access = "full" | "own" | "view" | "none"

export const ROLE_COLUMNS = ["Owner", "HR", "Sales", "Campaign Manager", "Support/DLT"] as const

export const PERMISSIONS: { area: string; items: { label: string; access: Record<(typeof ROLE_COLUMNS)[number], Access> }[] }[] = [
  {
    area: "Sales",
    items: [
      { label: "Leads & clients", access: { Owner: "full", HR: "none", Sales: "own", "Campaign Manager": "none", "Support/DLT": "none" } },
      { label: "Book services & record payments", access: { Owner: "full", HR: "none", Sales: "own", "Campaign Manager": "none", "Support/DLT": "none" } },
      { label: "Approve services & payments", access: { Owner: "full", HR: "none", Sales: "none", "Campaign Manager": "none", "Support/DLT": "none" } },
      { label: "Sales details & reports", access: { Owner: "full", HR: "none", Sales: "own", "Campaign Manager": "none", "Support/DLT": "none" } },
    ],
  },
  {
    area: "HR",
    items: [
      { label: "Employee records, documents & notes", access: { Owner: "full", HR: "full", Sales: "own", "Campaign Manager": "own", "Support/DLT": "own" } },
      { label: "Departments, designations & teams", access: { Owner: "full", HR: "full", Sales: "none", "Campaign Manager": "none", "Support/DLT": "none" } },
      { label: "Attendance register & reports", access: { Owner: "full", HR: "full", Sales: "own", "Campaign Manager": "own", "Support/DLT": "own" } },
      { label: "Approve leave", access: { Owner: "full", HR: "full", Sales: "none", "Campaign Manager": "none", "Support/DLT": "none" } },
      { label: "Onboarding, policies & assets", access: { Owner: "full", HR: "full", Sales: "view", "Campaign Manager": "view", "Support/DLT": "view" } },
      { label: "Salary & logins vault", access: { Owner: "full", HR: "full", Sales: "none", "Campaign Manager": "none", "Support/DLT": "none" } },
      { label: "Give someone the Owner role", access: { Owner: "full", HR: "none", Sales: "none", "Campaign Manager": "none", "Support/DLT": "none" } },
    ],
  },
  {
    area: "Everyone (self-service)",
    items: [
      { label: "Check in / check out", access: { Owner: "own", HR: "own", Sales: "own", "Campaign Manager": "own", "Support/DLT": "own" } },
      { label: "Apply for leave", access: { Owner: "own", HR: "own", Sales: "own", "Campaign Manager": "own", "Support/DLT": "own" } },
      { label: "Tasks", access: { Owner: "full", HR: "full", Sales: "own", "Campaign Manager": "own", "Support/DLT": "own" } },
    ],
  },
]

export const ACCESS_LABEL: Record<Access, string> = {
  full: "Full",
  own: "Own only",
  view: "View",
  none: "—",
}

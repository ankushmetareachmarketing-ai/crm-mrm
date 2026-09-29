import "server-only"

// Departments, designations and teams share one create/edit/delete API
// (app/api/hr/org/[kind]). This describes the columns each kind accepts.

export type OrgKind = "departments" | "designations" | "teams"

export const ORG_KINDS: OrgKind[] = ["departments", "designations", "teams"]

const UUID = /^[0-9a-f-]{36}$/i

interface OrgFieldSpec {
  column: string
  kind: "text" | "uuid"
}

export const ORG_FIELDS: Record<OrgKind, Record<string, OrgFieldSpec>> = {
  departments: {
    name: { column: "name", kind: "text" },
    description: { column: "description", kind: "text" },
    headEmployeeId: { column: "head_employee_id", kind: "uuid" },
  },
  designations: {
    name: { column: "name", kind: "text" },
    departmentId: { column: "department_id", kind: "uuid" },
  },
  teams: {
    name: { column: "name", kind: "text" },
    departmentId: { column: "department_id", kind: "uuid" },
    leadEmployeeId: { column: "lead_employee_id", kind: "uuid" },
  },
}

export const ORG_LABEL: Record<OrgKind, string> = {
  departments: "Department",
  designations: "Designation",
  teams: "Team",
}

/** Validates a request body into column → value pairs, or returns an error message. */
export function parseOrgBody(kind: OrgKind, body: Record<string, unknown>, requireName: boolean) {
  const values: Record<string, string | null> = {}
  for (const [key, spec] of Object.entries(ORG_FIELDS[kind])) {
    if (!(key in body)) continue
    const raw = body[key]
    const value = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw)
    if (spec.kind === "uuid") {
      if (value && !UUID.test(value)) return { error: `${key} is invalid.` }
      values[spec.column] = value || null
    } else {
      if (value.length > 120) return { error: `${key} is too long.` }
      values[spec.column] = value || null
    }
  }
  if (requireName && !values.name) return { error: `${ORG_LABEL[kind]} name is required.` }
  if ("name" in values && values.name === null) return { error: `${ORG_LABEL[kind]} name can't be empty.` }
  return { values }
}

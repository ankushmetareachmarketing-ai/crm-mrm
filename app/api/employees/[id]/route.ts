import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import { canManageHr, recordEmployeeHistory } from "@/lib/hr/server"
import { EMPLOYEE_STATUSES } from "@/lib/hr/constants"
import { notify } from "@/lib/notifications"
import { isValidDateString } from "@/lib/validate"

type FieldKind = "text" | "date" | "uuid" | "number" | "bool" | "status"

interface FieldSpec {
  column: string
  label: string
  kind: FieldKind
  /** Employees may edit these on their own profile. */
  self?: boolean
}

const FIELDS: Record<string, FieldSpec> = {
  name: { column: "name", label: "Name", kind: "text" },
  contact: { column: "contact", label: "Phone", kind: "text" },
  alternatePhone: { column: "alternate_phone", label: "Alternate phone", kind: "text", self: true },
  personalEmail: { column: "personal_email", label: "Personal email", kind: "text", self: true },
  workEmail: { column: "work_email", label: "Work email", kind: "text" },
  address: { column: "address", label: "Address", kind: "text", self: true },
  dateOfBirth: { column: "date_of_birth", label: "Date of birth", kind: "date" },
  gender: { column: "gender", label: "Gender", kind: "text" },
  maritalStatus: { column: "marital_status", label: "Marital status", kind: "text", self: true },
  bloodGroup: { column: "blood_group", label: "Blood group", kind: "text", self: true },
  emergencyContactName: { column: "emergency_contact_name", label: "Emergency contact", kind: "text", self: true },
  emergencyContactPhone: { column: "emergency_contact_phone", label: "Emergency phone", kind: "text", self: true },
  photoUrl: { column: "photo_url", label: "Photo", kind: "text" },
  employmentType: { column: "employment_type", label: "Employment type", kind: "text" },
  joiningDate: { column: "joining_date", label: "Joining date", kind: "date" },
  exitDate: { column: "exit_date", label: "Exit date", kind: "date" },
  departmentId: { column: "department_id", label: "Department", kind: "uuid" },
  designationId: { column: "designation_id", label: "Designation", kind: "uuid" },
  teamId: { column: "team_id", label: "Team", kind: "uuid" },
  reportingManagerId: { column: "reporting_manager_id", label: "Reporting manager", kind: "uuid" },
  accessProfileId: { column: "access_profile_id", label: "Role", kind: "uuid" },
  status: { column: "status", label: "Status", kind: "status" },
  salary: { column: "salary", label: "Salary", kind: "number" },
  active: { column: "active", label: "Login access", kind: "bool" },
}

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract"]
const UUID = /^[0-9a-f-]{36}$/i

// Human-readable before/after values for history (names instead of ids).
const LOOKUP_SQL: Record<string, string> = {
  department_id: `(select name from public.departments where id = $1)`,
  designation_id: `(select name from public.designations where id = $1)`,
  team_id: `(select name from public.teams where id = $1)`,
  reporting_manager_id: `(select name from public.employees where id = $1)`,
  access_profile_id: `(select name from public.access_profiles where id = $1)`,
}

async function display(column: string, value: unknown): Promise<string | null> {
  if (value === null || value === undefined || value === "") return null
  if (LOOKUP_SQL[column]) {
    const { rows } = await pool.query<{ v: string | null }>(`select ${LOOKUP_SQL[column]} as v`, [value])
    return rows[0]?.v ?? null
  }
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled"
  return String(value)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Employee not found." }, { status: 404 })

  const isManager = canManageHr(caller.role)
  const isSelf = caller.id === id
  if (!isManager && !isSelf) {
    return NextResponse.json({ error: "You can only edit your own profile." }, { status: 403 })
  }

  const body = (await request.json()) ?? {}

  const { rows: currentRows } = await pool.query<Record<string, unknown> & { role: string }>(
    `select e.*, p.name as role from public.employees e
     join public.access_profiles p on p.id = e.access_profile_id
     where e.id = $1`,
    [id]
  )
  const current = currentRows[0]
  if (!current) return NextResponse.json({ error: "Employee not found." }, { status: 404 })

  const updates: { column: string; label: string; value: unknown }[] = []
  for (const [key, spec] of Object.entries(FIELDS)) {
    if (!(key in body)) continue
    if (!isManager && !spec.self) {
      return NextResponse.json({ error: `Only HR can change ${spec.label.toLowerCase()}.` }, { status: 403 })
    }
    const raw = body[key]
    let value: unknown
    switch (spec.kind) {
      case "text": {
        const text = typeof raw === "string" ? raw.trim() : ""
        if (text.length > 500) return NextResponse.json({ error: `${spec.label} is too long.` }, { status: 400 })
        if (key === "name" && !text) return NextResponse.json({ error: "Name can't be empty." }, { status: 400 })
        if (key === "employmentType" && !EMPLOYMENT_TYPES.includes(text)) {
          return NextResponse.json({ error: "Employment type is invalid." }, { status: 400 })
        }
        value = text || null
        break
      }
      case "date":
        if (raw && !isValidDateString(raw)) return NextResponse.json({ error: `${spec.label} is invalid.` }, { status: 400 })
        if (key === "joiningDate" && !raw) return NextResponse.json({ error: "Joining date is required." }, { status: 400 })
        value = raw || null
        break
      case "uuid":
        if (raw && !(typeof raw === "string" && UUID.test(raw))) {
          return NextResponse.json({ error: `${spec.label} is invalid.` }, { status: 400 })
        }
        if (key === "reportingManagerId" && raw === id) {
          return NextResponse.json({ error: "An employee can't report to themselves." }, { status: 400 })
        }
        if (key === "accessProfileId" && !raw) return NextResponse.json({ error: "Role is required." }, { status: 400 })
        value = raw || null
        break
      case "number":
        if (raw !== null && raw !== "" && !(Number.isFinite(Number(raw)) && Number(raw) >= 0)) {
          return NextResponse.json({ error: `${spec.label} must be a positive number.` }, { status: 400 })
        }
        value = raw === null || raw === "" ? null : Number(raw)
        break
      case "bool":
        value = Boolean(raw)
        break
      case "status":
        if (!EMPLOYEE_STATUSES.includes(raw)) return NextResponse.json({ error: "Status is invalid." }, { status: 400 })
        value = raw
        break
    }
    updates.push({ column: spec.column, label: spec.label, value })
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
  }

  // Role rules: only the Owner hands out or takes away the Owner role, and
  // nobody can switch off their own login.
  const roleUpdate = updates.find((u) => u.column === "access_profile_id")
  if (caller.role !== "Owner" && !(isSelf && !isManager)) {
    if (current.role === "Owner") {
      return NextResponse.json({ error: "Only the Owner can change the Owner's record." }, { status: 403 })
    }
    if (roleUpdate) {
      const { rows } = await pool.query<{ name: string }>(`select name from public.access_profiles where id = $1`, [
        roleUpdate.value,
      ])
      if (!rows[0]) return NextResponse.json({ error: "Role not found." }, { status: 400 })
      if (rows[0].name === "Owner") {
        return NextResponse.json({ error: "Only the Owner can give someone the Owner role." }, { status: 403 })
      }
    }
  }
  if (isSelf && updates.some((u) => u.column === "active" && u.value === false)) {
    return NextResponse.json({ error: "You can't switch off your own login." }, { status: 400 })
  }

  // Leaving the company ends login access too.
  const statusUpdate = updates.find((u) => u.column === "status")
  if (statusUpdate && ["Resigned", "Terminated", "Inactive"].includes(String(statusUpdate.value))) {
    if (!updates.some((u) => u.column === "active")) updates.push({ column: "active", label: "Login access", value: false })
    if (!updates.some((u) => u.column === "exit_date") && !current.exit_date && statusUpdate.value !== "Inactive") {
      updates.push({ column: "exit_date", label: "Exit date", value: new Date().toISOString().slice(0, 10) })
    }
  }

  const changed = updates.filter((u) => {
    const before = current[u.column]
    const norm = (v: unknown) =>
      v instanceof Date ? v.toISOString().slice(0, 10) : v === null || v === undefined ? null : String(v)
    return norm(before) !== norm(u.value)
  })
  if (changed.length === 0) return NextResponse.json({ ok: true })

  const db = await pool.connect()
  try {
    await db.query("begin")
    await db.query(
      `update public.employees set ${changed.map((u, i) => `${u.column} = $${i + 1}`).join(", ")}
       where id = $${changed.length + 1}`,
      [...changed.map((u) => u.value), id]
    )

    const history = []
    for (const u of changed) {
      const beforeRaw = current[u.column]
      const before = beforeRaw instanceof Date ? beforeRaw.toISOString().slice(0, 10) : beforeRaw
      const action =
        u.column === "department_id"
          ? "Department changed"
          : u.column === "designation_id"
            ? "Designation changed"
            : u.column === "reporting_manager_id"
              ? "Manager changed"
              : u.column === "access_profile_id"
                ? "Role changed"
                : u.column === "status"
                  ? "Status changed"
                  : u.column === "salary"
                    ? "Salary changed"
                    : "Profile updated"
      history.push({
        employeeId: id,
        actorId: caller.id,
        action,
        field: u.label,
        // Salary amounts stay out of the history text.
        before: u.column === "salary" ? null : await display(u.column, before),
        after: u.column === "salary" ? null : await display(u.column, u.value),
      })
    }
    await recordEmployeeHistory(db, history)

    const newManager = changed.find((u) => u.column === "reporting_manager_id")?.value
    if (typeof newManager === "string") {
      await notify(
        {
          employeeIds: [newManager],
          actorId: caller.id,
          kind: "employee",
          title: "New team member",
          detail: `${current.name} now reports to you.`,
          link: `/hr/employees/${id}`,
        },
        db
      )
    }

    await db.query("commit")
  } catch (error) {
    await db.query("rollback")
    logError("employees.update", error, { employeeId: id, callerId: caller.id })
    return NextResponse.json({ error: "Could not save the changes. Please try again." }, { status: 500 })
  } finally {
    db.release()
  }

  revalidateTag("employees-list", "max")
  return NextResponse.json({ ok: true })
}

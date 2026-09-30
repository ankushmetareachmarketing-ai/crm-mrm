import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import { canManageHr, recordEmployeeHistory } from "@/lib/hr/server"
import { EMPLOYEE_STATUSES } from "@/lib/hr/constants"
import { notify } from "@/lib/notifications"
import { deleteEmployeeDocument } from "@/lib/storage"
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
  alternatePhone: { column: "alternate_phone", label: "Alternate phone", kind: "text" },
  loginId: { column: "login_id", label: "Username (login ID)", kind: "text" },
  personalEmail: { column: "personal_email", label: "Personal email", kind: "text", self: true },
  workEmail: { column: "work_email", label: "Work email", kind: "text" },
  address: { column: "address", label: "Address", kind: "text", self: true },
  dateOfBirth: { column: "date_of_birth", label: "Date of birth", kind: "date" },
  gender: { column: "gender", label: "Gender", kind: "text" },
  maritalStatus: { column: "marital_status", label: "Marital status", kind: "text", self: true },
  bloodGroup: { column: "blood_group", label: "Blood group", kind: "text", self: true },
  emergencyContactName: { column: "emergency_contact_name", label: "Emergency contact", kind: "text", self: true },
  emergencyContactPhone: { column: "emergency_contact_phone", label: "Emergency phone", kind: "text", self: true },
  photoUrl: { column: "photo_url", label: "Photo", kind: "text", self: true },
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
      return NextResponse.json({ error: `Only HR or the Owner can change ${spec.label.toLowerCase()}.` }, { status: 403 })
    }
    const raw = body[key]
    let value: unknown
    switch (spec.kind) {
      case "text": {
        const text = typeof raw === "string" ? raw.trim() : ""
        if (text.length > 500) return NextResponse.json({ error: `${spec.label} is too long.` }, { status: 400 })
        if (key === "name" && !text) return NextResponse.json({ error: "Name can't be empty." }, { status: 400 })
        if (key === "contact" && !text) return NextResponse.json({ error: "Phone can't be empty." }, { status: 400 })
        if (key === "loginId") {
          if (!/^[a-zA-Z0-9._@-]{3,60}$/.test(text)) {
            return NextResponse.json(
              { error: "Username must be 3–60 characters: letters, numbers, dot, dash, underscore or @." },
              { status: 400 }
            )
          }
          const { rows: taken } = await pool.query(
            `select 1 from public.employees where lower(login_id) = lower($1) and id <> $2`,
            [text, id]
          )
          if (taken.length > 0) return NextResponse.json({ error: "That username is already taken." }, { status: 400 })
        }
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

/**
 * Owner only: permanently delete an employee — meant for someone added by
 * mistake or who never started. If they own clients / leads or recorded
 * payments, services or calls, deleting would break the business history,
 * so it is refused with a count and the Owner is told to mark them
 * Terminated instead. Their personal HR data (attendance, leave, documents,
 * notes, onboarding, logins) is removed with them; elsewhere their name is
 * just cleared from "done by" fields.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  if (caller.role !== "Owner") return NextResponse.json({ error: "Only the Owner can delete an employee." }, { status: 403 })

  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Employee not found." }, { status: 404 })
  if (id === caller.id) return NextResponse.json({ error: "You can't delete yourself." }, { status: 400 })

  const { rows } = await pool.query<{ name: string; employee_code: string; role: string }>(
    `select e.name, e.employee_code, p.name as role
     from public.employees e join public.access_profiles p on p.id = e.access_profile_id
     where e.id = $1`,
    [id]
  )
  const target = rows[0]
  if (!target) return NextResponse.json({ error: "Employee not found." }, { status: 404 })
  if (target.role === "Owner") return NextResponse.json({ error: "An Owner can't be deleted." }, { status: 400 })

  const { rows: usage } = await pool.query<Record<string, number>>(
    `select
       (select count(*)::int from public.clients where owner_employee_id = $1) as clients,
       (select count(*)::int from public.leads where owner_employee_id = $1) as leads,
       (select count(*)::int from public.payments where recorded_by_employee_id = $1 or approved_by_employee_id = $1) as payments,
       (select count(*)::int from public.client_charges where recorded_by_employee_id = $1 or approved_by_employee_id = $1) as services,
       (select count(*)::int from public.call_logs where employee_id = $1) as calls`,
    [id]
  )
  const used = Object.entries(usage[0]).filter(([, n]) => n > 0)
  if (used.length > 0) {
    return NextResponse.json(
      {
        error: `${target.name} has ${used.map(([k, n]) => `${n} ${k}`).join(", ")}. Deleting would break that history — set their status to Terminated (or Resigned) instead, which also turns off their login.`,
        blocked: true,
      },
      { status: 409 }
    )
  }

  const db = await pool.connect()
  let documentPaths: string[] = []
  try {
    await db.query("begin")
    const { rows: docs } = await db.query<{ storage_path: string }>(
      `select storage_path from public.employee_documents where employee_id = $1`,
      [id]
    )
    documentPaths = docs.map((d) => d.storage_path)

    // Assets they still hold go back to the store.
    await db.query(
      `update public.assets set status = 'Available'
       where id in (select asset_id from public.asset_assignments where employee_id = $1 and returned_at is null)`,
      [id]
    )
    // Their own work items go; "done by" references elsewhere are cleared.
    await db.query(`delete from public.tasks where assigned_employee_id = $1`, [id])
    await db.query(`delete from public.call_list_entries where owner_employee_id = $1`, [id])
    await db.query(`delete from public.follow_ups where employee_id = $1`, [id])
    for (const [table, column] of [
      ["tasks", "created_by_employee_id"],
      ["tasks", "completed_by_employee_id"],
      ["activity_log", "actor_employee_id"],
      ["notes", "author_employee_id"],
      ["entity_requirements", "owner_employee_id"],
      ["entity_requirements", "created_by_employee_id"],
      ["payment_reminders", "created_by_employee_id"],
      ["employee_credentials", "created_by_employee_id"],
      ["employee_credentials", "updated_by_employee_id"],
      ["employee_credential_history", "changed_by_employee_id"],
    ]) {
      await db.query(`update public.${table} set ${column} = null where ${column} = $1`, [id])
    }
    // Notifications pointing at their (soon gone) profile would be dead links.
    await db.query(`delete from public.notifications where link = $1`, [`/hr/employees/${id}`])
    await db.query(`delete from public.employees where id = $1`, [id])

    // A record of who was deleted, kept on the Owner's own history.
    await recordEmployeeHistory(db, [
      { employeeId: caller.id, actorId: caller.id, action: "Deleted an employee", after: `${target.name} (${target.employee_code})` },
    ])
    await db.query("commit")
  } catch (error) {
    await db.query("rollback")
    if ((error as { code?: string }).code === "23503") {
      return NextResponse.json(
        { error: `${target.name} is still linked to other records. Set their status to Terminated instead.`, blocked: true },
        { status: 409 }
      )
    }
    logError("employees.delete", error, { employeeId: id, callerId: caller.id })
    return NextResponse.json({ error: "Could not delete the employee. Please try again." }, { status: 500 })
  } finally {
    db.release()
  }

  if (documentPaths.length > 0) {
    await Promise.all(documentPaths.map((p) => deleteEmployeeDocument(p).catch(() => {})))
  }
  revalidateTag("employees-list", "max")
  return NextResponse.json({ ok: true })
}

import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import { notify } from "@/lib/notifications"
import { hashPassword } from "@/lib/auth/password"
import { EMPLOYMENT_TYPES } from "@/lib/hr/constants"
import { createOnboardingTasks } from "@/lib/hr/onboarding"
import { canManageHr, recordEmployeeHistory } from "@/lib/hr/server"
import { isValidDateString } from "@/lib/validate"

const UUID = /^[0-9a-f-]{36}$/i
const optionalUuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null)
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : null)

/**
 * Adds an employee. By default they start in "Onboarding" with login
 * switched off and a checklist to work through; HR activates them from the
 * onboarding screen. Pass startOnboarding: false to create an active login
 * straight away.
 */
export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  if (!canManageHr(caller.role)) {
    return NextResponse.json({ error: "Only Owner or HR can add employees." }, { status: 403 })
  }

  const body = (await request.json()) ?? {}
  const { name, contact, employmentType, accessProfileId, loginId, password } = body
  const startOnboarding = body.startOnboarding !== false

  if (!text(name) || !text(contact) || !accessProfileId || !text(loginId) || !password) {
    return NextResponse.json({ error: "Name, phone, role, login ID and password are required." }, { status: 400 })
  }
  if (!(EMPLOYMENT_TYPES as readonly string[]).includes(employmentType)) {
    return NextResponse.json({ error: "Employment type is invalid." }, { status: 400 })
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 })
  }
  for (const key of ["dateOfBirth", "joiningDate"]) {
    if (body[key] && !isValidDateString(body[key])) {
      return NextResponse.json({ error: `${key === "dateOfBirth" ? "Date of birth" : "Joining date"} is invalid.` }, { status: 400 })
    }
  }
  if (body.salary && !(Number(body.salary) >= 0)) {
    return NextResponse.json({ error: "Salary must be a positive number." }, { status: 400 })
  }

  const [{ rows: existing }, { rows: roleRows }] = await Promise.all([
    pool.query(`select 1 from public.employees where lower(login_id) = lower($1)`, [String(loginId).trim()]),
    pool.query<{ name: string }>(`select name from public.access_profiles where id = $1`, [accessProfileId]),
  ])
  if (existing.length > 0) {
    return NextResponse.json({ error: "That login ID is already taken." }, { status: 400 })
  }
  const roleName = roleRows[0]?.name
  if (!roleName) return NextResponse.json({ error: "Role not found." }, { status: 400 })
  if (roleName === "Owner" && caller.role !== "Owner") {
    return NextResponse.json({ error: "Only the Owner can create another Owner." }, { status: 403 })
  }

  const passwordHash = await hashPassword(String(password))

  const db = await pool.connect()
  let employee: { id: string; name: string; employee_code: string; contact: string; login_id: string; employment_type: string; joining_date: string; active: boolean; status: string }
  try {
    await db.query("begin")
    const { rows } = await db.query<typeof employee>(
      `insert into public.employees
         (name, contact, login_id, password_hash, employment_type, access_profile_id, photo_url, date_of_birth,
          address, emergency_contact_name, emergency_contact_phone, salary, joining_date, department_id,
          designation_id, team_id, reporting_manager_id, work_email, personal_email, gender, status, active)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, coalesce($13::date, current_date), $14, $15, $16, $17,
               $18, $19, $20, $21, $22)
       returning id, name, employee_code, contact, login_id, employment_type, joining_date::text, active, status`,
      [
        text(name),
        text(contact),
        String(loginId).trim(),
        passwordHash,
        employmentType,
        accessProfileId,
        text(body.photoUrl),
        body.dateOfBirth || null,
        text(body.address),
        text(body.emergencyContactName),
        text(body.emergencyContactPhone),
        body.salary ? Number(body.salary) : null,
        body.joiningDate || null,
        optionalUuid(body.departmentId),
        optionalUuid(body.designationId),
        optionalUuid(body.teamId),
        optionalUuid(body.reportingManagerId),
        text(body.workEmail),
        text(body.personalEmail),
        text(body.gender),
        startOnboarding ? "Onboarding" : "Active",
        !startOnboarding,
      ]
    )
    employee = rows[0]

    await recordEmployeeHistory(db, [
      { employeeId: employee.id, actorId: caller.id, action: "Joined", field: "Role", after: roleName },
    ])
    if (startOnboarding) await createOnboardingTasks(db, employee.id)

    await notify(
      {
        roles: ["Owner", "HR"],
        employeeIds: [optionalUuid(body.reportingManagerId)],
        actorId: caller.id,
        kind: "employee",
        title: startOnboarding ? "New joiner — onboarding started" : "New employee added",
        detail: `${employee.name} (${employee.employee_code}) was added as ${roleName}.`,
        link: `/hr/employees/${employee.id}`,
      },
      db
    )
    await db.query("commit")
  } catch (error) {
    await db.query("rollback")
    logError("employees.create", error, { callerId: caller.id })
    return NextResponse.json({ error: "Could not add the employee. Please try again." }, { status: 500 })
  } finally {
    db.release()
  }

  revalidateTag("employees-list", "max")

  return NextResponse.json({ employee: { ...employee, access_profiles: { name: roleName } } }, { status: 201 })
}

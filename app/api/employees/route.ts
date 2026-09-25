import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { notify } from "@/lib/notifications"
import { hashPassword } from "@/lib/auth/password"

export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  if (caller.role !== "Owner" && caller.role !== "HR") {
    return NextResponse.json({ error: "Only Owner or HR can add employees." }, { status: 403 })
  }

  const body = await request.json()
  const {
    name,
    contact,
    employmentType,
    accessProfileId,
    loginId,
    password,
    photoUrl,
    dateOfBirth,
    address,
    department,
    emergencyContactName,
    emergencyContactPhone,
    salary,
  } = body ?? {}

  if (!name || !contact || !employmentType || !accessProfileId || !loginId || !password) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 })
  }

  const { rows: existing } = await pool.query(
    `select 1 from public.employees where login_id = $1`,
    [loginId]
  )
  if (existing.length > 0) {
    return NextResponse.json({ error: "That login ID is already taken." }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)

  const { rows } = await pool.query(
    `insert into public.employees
       (name, contact, login_id, password_hash, employment_type, access_profile_id,
        photo_url, date_of_birth, address, department, emergency_contact_name, emergency_contact_phone, salary)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     returning id, name, contact, login_id, employment_type, joining_date::text, active`,
    [
      name,
      contact,
      loginId,
      passwordHash,
      employmentType,
      accessProfileId,
      photoUrl || null,
      dateOfBirth || null,
      address || null,
      department || null,
      emergencyContactName || null,
      emergencyContactPhone || null,
      salary ? Number(salary) : null,
    ]
  )
  const employee = rows[0]

  const { rows: profileRows } = await pool.query(
    `select name from public.access_profiles where id = $1`,
    [accessProfileId]
  )
  const profileName = profileRows[0]?.name ?? "—"

  await notify({
    roles: ["Owner", "HR"],
    actorId: caller.id,
    kind: "employee",
    title: "New employee added",
    detail: `${name} was added as ${profileName}.`,
    link: `/hr/employees/${employee.id}`,
  })

  revalidateTag("employees-list", "max")

  return NextResponse.json(
    { employee: { ...employee, access_profiles: { name: profileName } } },
    { status: 201 }
  )
}

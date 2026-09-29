import "server-only"
import { pool } from "@/lib/db"
import type { EmployeeStatus } from "@/lib/hr/constants"
import type { LeaveStatus } from "@/lib/hr/leave"
import type {
  AssetRow,
  AttendanceRow,
  EmployeeAsset,
  EmployeeDocument,
  EmployeeHistoryEntry,
  EmployeeNote,
  EmployeeProfile,
  EmployeeSummary,
  LeaveRequestRow,
  OnboardingTask,
  OrgOptions,
  PolicyRow,
} from "@/lib/hr/types"

const iso = (column: string) => `to_json(${column})#>>'{}'`

export async function getOrgOptions(): Promise<OrgOptions> {
  const [departments, designations, teams, roles, people] = await Promise.all([
    pool.query<{ id: string; name: string; description: string | null; head_employee_id: string | null }>(
      `select id, name, description, head_employee_id from public.departments order by name`
    ),
    pool.query<{ id: string; name: string; department_id: string | null }>(
      `select id, name, department_id from public.designations order by name`
    ),
    pool.query<{ id: string; name: string; department_id: string | null; lead_employee_id: string | null }>(
      `select id, name, department_id, lead_employee_id from public.teams order by name`
    ),
    pool.query<{ id: string; name: string }>(`select id, name from public.access_profiles order by name`),
    pool.query<{ id: string; name: string }>(`select id, name from public.employees where active order by name`),
  ])
  return {
    departments: departments.rows.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      headEmployeeId: d.head_employee_id,
    })),
    designations: designations.rows.map((d) => ({ id: d.id, name: d.name, departmentId: d.department_id })),
    teams: teams.rows.map((t) => ({
      id: t.id,
      name: t.name,
      departmentId: t.department_id,
      leadEmployeeId: t.lead_employee_id,
    })),
    roles: roles.rows,
    people: people.rows,
  }
}

const EMPLOYEE_SELECT = `
  select e.id, e.employee_code, e.name, e.photo_url, p.name as role, e.access_profile_id, e.status, e.active,
         e.contact, e.work_email, e.joining_date::text, e.employment_type,
         e.department_id, d.name as department, e.designation_id, g.name as designation,
         e.team_id, t.name as team, e.reporting_manager_id, m.name as manager,
         e.login_id, e.alternate_phone, e.personal_email, e.address, e.date_of_birth::text, e.gender,
         e.marital_status, e.blood_group, e.emergency_contact_name, e.emergency_contact_phone,
         e.exit_date::text, e.salary::text
  from public.employees e
  join public.access_profiles p on p.id = e.access_profile_id
  left join public.departments d on d.id = e.department_id
  left join public.designations g on g.id = e.designation_id
  left join public.teams t on t.id = e.team_id
  left join public.employees m on m.id = e.reporting_manager_id`

interface EmployeeRow {
  id: string
  employee_code: string
  name: string
  photo_url: string | null
  role: string
  access_profile_id: string
  status: EmployeeStatus
  active: boolean
  contact: string
  work_email: string | null
  joining_date: string
  employment_type: string
  department_id: string | null
  department: string | null
  designation_id: string | null
  designation: string | null
  team_id: string | null
  team: string | null
  reporting_manager_id: string | null
  manager: string | null
  login_id: string
  alternate_phone: string | null
  personal_email: string | null
  address: string | null
  date_of_birth: string | null
  gender: string | null
  marital_status: string | null
  blood_group: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  exit_date: string | null
  salary: string | null
}

function toSummary(r: EmployeeRow): EmployeeSummary {
  return {
    id: r.id,
    code: r.employee_code,
    name: r.name,
    photoUrl: r.photo_url,
    role: r.role,
    status: r.status,
    active: r.active,
    contact: r.contact,
    workEmail: r.work_email,
    joiningDate: r.joining_date,
    employmentType: r.employment_type,
    departmentId: r.department_id,
    department: r.department,
    designationId: r.designation_id,
    designation: r.designation,
    teamId: r.team_id,
    team: r.team,
    managerId: r.reporting_manager_id,
    manager: r.manager,
  }
}

export async function getEmployeeDirectory(): Promise<EmployeeSummary[]> {
  const { rows } = await pool.query<EmployeeRow>(`${EMPLOYEE_SELECT} order by e.employee_code`)
  return rows.map(toSummary)
}

export async function getEmployeeProfile(id: string): Promise<EmployeeProfile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { rows } = await pool.query<EmployeeRow>(`${EMPLOYEE_SELECT} where e.id = $1`, [id])
  const r = rows[0]
  if (!r) return null
  return {
    ...toSummary(r),
    loginId: r.login_id,
    roleId: r.access_profile_id,
    alternatePhone: r.alternate_phone,
    personalEmail: r.personal_email,
    address: r.address,
    dateOfBirth: r.date_of_birth,
    gender: r.gender,
    maritalStatus: r.marital_status,
    bloodGroup: r.blood_group,
    emergencyContactName: r.emergency_contact_name,
    emergencyContactPhone: r.emergency_contact_phone,
    exitDate: r.exit_date,
    salary: r.salary === null ? null : Number(r.salary),
  }
}

export async function getEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]> {
  const { rows } = await pool.query<{
    id: string
    category: string
    title: string
    file_name: string
    size_bytes: number | null
    uploaded_by: string | null
    created_at: string
  }>(
    `select d.id, d.category, d.title, d.file_name, d.size_bytes, u.name as uploaded_by, ${iso("d.created_at")} as created_at
     from public.employee_documents d
     left join public.employees u on u.id = d.uploaded_by_employee_id
     where d.employee_id = $1
     order by d.created_at desc`,
    [employeeId]
  )
  return rows.map((d) => ({
    id: d.id,
    category: d.category,
    title: d.title,
    fileName: d.file_name,
    sizeBytes: d.size_bytes,
    uploadedBy: d.uploaded_by,
    createdAt: d.created_at,
  }))
}

export async function getEmployeeNotes(employeeId: string): Promise<EmployeeNote[]> {
  const { rows } = await pool.query<{ id: string; body: string; author: string | null; created_at: string }>(
    `select n.id, n.body, a.name as author, ${iso("n.created_at")} as created_at
     from public.employee_notes n
     left join public.employees a on a.id = n.author_employee_id
     where n.employee_id = $1
     order by n.created_at desc`,
    [employeeId]
  )
  return rows.map((n) => ({ id: n.id, body: n.body, author: n.author, createdAt: n.created_at }))
}

export async function getEmployeeHistory(employeeId: string): Promise<EmployeeHistoryEntry[]> {
  const { rows } = await pool.query<{
    id: string
    action: string
    field: string | null
    before_value: string | null
    after_value: string | null
    actor: string | null
    created_at: string
  }>(
    `select h.id, h.action, h.field, h.before_value, h.after_value, a.name as actor, ${iso("h.created_at")} as created_at
     from public.employee_history h
     left join public.employees a on a.id = h.actor_employee_id
     where h.employee_id = $1
     order by h.created_at desc
     limit 200`,
    [employeeId]
  )
  return rows.map((h) => ({
    id: h.id,
    action: h.action,
    field: h.field,
    before: h.before_value,
    after: h.after_value,
    actor: h.actor,
    createdAt: h.created_at,
  }))
}

export async function getOnboardingTasks(employeeId: string): Promise<OnboardingTask[]> {
  const { rows } = await pool.query<{
    id: string
    title: string
    category: string
    done_at: string | null
    done_by: string | null
  }>(
    `select t.id, t.title, t.category, ${iso("t.done_at")} as done_at, u.name as done_by
     from public.employee_onboarding_tasks t
     left join public.employees u on u.id = t.done_by_employee_id
     where t.employee_id = $1
     order by t.sort_order, t.created_at`,
    [employeeId]
  )
  return rows.map((t) => ({ id: t.id, title: t.title, category: t.category, doneAt: t.done_at, doneBy: t.done_by }))
}

export async function getEmployeeAssets(employeeId: string): Promise<EmployeeAsset[]> {
  const { rows } = await pool.query<{
    assignment_id: string
    asset_id: string
    asset_tag: string
    name: string
    category: string
    assigned_at: string
    returned_at: string | null
  }>(
    `select s.id as assignment_id, a.id as asset_id, a.asset_tag, a.name, a.category,
            ${iso("s.assigned_at")} as assigned_at, ${iso("s.returned_at")} as returned_at
     from public.asset_assignments s
     join public.assets a on a.id = s.asset_id
     where s.employee_id = $1
     order by s.returned_at is not null, s.assigned_at desc`,
    [employeeId]
  )
  return rows.map((r) => ({
    assignmentId: r.assignment_id,
    assetId: r.asset_id,
    assetTag: r.asset_tag,
    name: r.name,
    category: r.category,
    assignedAt: r.assigned_at,
    returnedAt: r.returned_at,
  }))
}

export async function getAssets(): Promise<AssetRow[]> {
  const { rows } = await pool.query<{
    id: string
    asset_tag: string
    name: string
    category: string
    serial_number: string | null
    status: string
    notes: string | null
    holder_id: string | null
    holder: string | null
    assigned_at: string | null
  }>(
    `select a.id, a.asset_tag, a.name, a.category, a.serial_number, a.status, a.notes,
            s.employee_id as holder_id, e.name as holder, ${iso("s.assigned_at")} as assigned_at
     from public.assets a
     left join public.asset_assignments s on s.asset_id = a.id and s.returned_at is null
     left join public.employees e on e.id = s.employee_id
     order by a.asset_tag`
  )
  return rows.map((r) => ({
    id: r.id,
    assetTag: r.asset_tag,
    name: r.name,
    category: r.category,
    serialNumber: r.serial_number,
    status: r.status,
    notes: r.notes,
    holderId: r.holder_id,
    holder: r.holder,
    assignedAt: r.assigned_at,
  }))
}

/** Leave requests — all of them, or one employee's. */
export async function getLeaveRequests(employeeId?: string): Promise<LeaveRequestRow[]> {
  const { rows } = await pool.query<{
    id: string
    employee_id: string
    employee: string
    employee_code: string
    leave_type: string
    start_date: string
    end_date: string
    half_day: boolean
    days: string
    reason: string | null
    status: LeaveStatus
    decided_by: string | null
    decided_at: string | null
    decision_note: string | null
    created_at: string
  }>(
    `select r.id, r.employee_id, e.name as employee, e.employee_code, t.name as leave_type,
            r.start_date::text, r.end_date::text, r.half_day, r.days::text, r.reason, r.status,
            d.name as decided_by, ${iso("r.decided_at")} as decided_at, r.decision_note, ${iso("r.created_at")} as created_at
     from public.leave_requests r
     join public.employees e on e.id = r.employee_id
     join public.leave_types t on t.id = r.leave_type_id
     left join public.employees d on d.id = r.decided_by_employee_id
     where ($1::uuid is null or r.employee_id = $1::uuid)
     order by (r.status = 'Pending') desc, r.start_date desc
     limit 500`,
    [employeeId ?? null]
  )
  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employee_id,
    employee: r.employee,
    employeeCode: r.employee_code,
    leaveType: r.leave_type,
    startDate: r.start_date,
    endDate: r.end_date,
    halfDay: r.half_day,
    days: Number(r.days),
    reason: r.reason,
    status: r.status,
    decidedBy: r.decided_by,
    decidedAt: r.decided_at,
    decisionNote: r.decision_note,
    createdAt: r.created_at,
  }))
}

export async function getLeaveTypes() {
  const { rows } = await pool.query<{ id: string; name: string; days_per_year: string | null; paid: boolean }>(
    `select id, name, days_per_year::text, paid from public.leave_types where active order by paid desc, name`
  )
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    daysPerYear: t.days_per_year === null ? null : Number(t.days_per_year),
    paid: t.paid,
  }))
}

/** Attendance rows between two dates, optionally for one employee. */
export async function getAttendanceRows(start: string, end: string, employeeId?: string): Promise<AttendanceRow[]> {
  const { rows } = await pool.query<{
    id: string
    employee_id: string
    work_date: string
    check_in_at: string | null
    check_out_at: string | null
    status: AttendanceRow["status"]
    penalty_amount: string
    penalty_reason: string | null
    notes: string | null
  }>(
    `select id, employee_id, work_date::text, ${iso("check_in_at")} as check_in_at, ${iso("check_out_at")} as check_out_at,
            status, penalty_amount::text, penalty_reason, notes
     from public.attendance_entries
     where work_date between $1 and $2 and ($3::uuid is null or employee_id = $3::uuid)
     order by work_date`,
    [start, end, employeeId ?? null]
  )
  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employee_id,
    workDate: r.work_date,
    checkInAt: r.check_in_at,
    checkOutAt: r.check_out_at,
    status: r.status,
    penaltyAmount: Number(r.penalty_amount),
    penaltyReason: r.penalty_reason,
    notes: r.notes,
  }))
}

/** Active policies, with whether the given employee accepted each and how many have. */
export async function getPolicies(employeeId: string, includeInactive = false): Promise<PolicyRow[]> {
  const { rows } = await pool.query<{
    id: string
    title: string
    body: string
    active: boolean
    updated_at: string
    acknowledged_at: string | null
    acknowledged_count: number
  }>(
    `select p.id, p.title, p.body, p.active, ${iso("p.updated_at")} as updated_at,
            ${iso("mine.acknowledged_at")} as acknowledged_at,
            (select count(*)::int from public.policy_acknowledgements a where a.policy_id = p.id) as acknowledged_count
     from public.policies p
     left join public.policy_acknowledgements mine on mine.policy_id = p.id and mine.employee_id = $1
     where $2 or p.active
     order by p.active desc, p.created_at desc`,
    [employeeId, includeInactive]
  )
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    active: p.active,
    updatedAt: p.updated_at,
    acknowledgedAt: p.acknowledged_at,
    acknowledgedCount: p.acknowledged_count,
  }))
}

import { pool } from "@/lib/db"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import type { AttendanceEntry } from "@/lib/types"
import { AttendanceClient } from "./attendance-client"

interface EntryRow {
  id: string
  employee_id: string
  employee_name: string
  work_date: string
  check_in_at: string | null
  check_out_at: string | null
  status: AttendanceEntry["status"]
  penalty_amount: string
  penalty_reason: string | null
  notes: string | null
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const currentEmployee = await getCurrentEmployee()
  const canManage = currentEmployee.role === "Owner" || currentEmployee.role === "HR"
  const { tab } = await searchParams
  const initialTab = tab === "salary" && canManage ? "salary" : "attendance"

  const [employeesResult, entriesResult] = await Promise.all([
    canManage
      ? pool.query<{ id: string; name: string; active: boolean; salary: string | null }>(
          `select id, name, active, salary::text from public.employees order by name`
        )
      : pool.query<{ id: string; name: string; active: boolean; salary: string | null }>(
          `select id, name, active, salary::text from public.employees where id = $1`,
          [currentEmployee.id]
        ),
    canManage
      ? pool.query<EntryRow>(
          `select a.id, a.employee_id, e.name as employee_name, a.work_date::text, a.check_in_at::text,
                  a.check_out_at::text, a.status, a.penalty_amount::text, a.penalty_reason, a.notes
           from public.attendance_entries a
           join public.employees e on e.id = a.employee_id
           where a.work_date >= current_date - interval '400 days'
           order by a.work_date desc`
        )
      : pool.query<EntryRow>(
          `select a.id, a.employee_id, e.name as employee_name, a.work_date::text, a.check_in_at::text,
                  a.check_out_at::text, a.status, a.penalty_amount::text, a.penalty_reason, a.notes
           from public.attendance_entries a
           join public.employees e on e.id = a.employee_id
           where a.work_date >= current_date - interval '400 days' and a.employee_id = $1
           order by a.work_date desc`,
          [currentEmployee.id]
        ),
  ])

  const employees = employeesResult.rows.map((e) => ({
    id: e.id,
    name: e.name,
    active: e.active,
    salary: e.salary ? Number(e.salary) : null,
  }))

  const entries: AttendanceEntry[] = entriesResult.rows.map((e) => ({
    id: e.id,
    employeeId: e.employee_id,
    employeeName: e.employee_name,
    workDate: e.work_date,
    checkInAt: e.check_in_at,
    checkOutAt: e.check_out_at,
    status: e.status,
    penaltyAmount: Number(e.penalty_amount),
    penaltyReason: e.penalty_reason,
    notes: e.notes,
  }))

  return (
    <AttendanceClient
      currentEmployeeId={currentEmployee.id}
      canManage={canManage}
      employees={employees}
      initialEntries={entries}
      initialTab={initialTab}
    />
  )
}

import "server-only"
import { pool } from "@/lib/db"
import { OFFICE_TZ } from "@/lib/hr/time"

export async function getTodayAttendance(employeeId: string) {
  const { rows } = await pool.query<{ check_in_at: string | null; check_out_at: string | null; status: string }>(
    `select to_json(check_in_at)#>>'{}' as check_in_at, to_json(check_out_at)#>>'{}' as check_out_at, status
     from public.attendance_entries
     where employee_id = $1 and work_date = (now() at time zone '${OFFICE_TZ}')::date`,
    [employeeId]
  )
  const r = rows[0]
  return { checkInAt: r?.check_in_at ?? null, checkOutAt: r?.check_out_at ?? null, status: r?.status ?? null }
}

export interface TaskRow {
  id: string
  title: string
  description: string | null
  priority: string
  dueDate: string | null
  status: string
  assignee: string | null
  assigneeId: string | null
  createdBy: string | null
  createdAt: string
}

/** Tasks given to me, and tasks I gave to others. */
export async function getMyTasks(employeeId: string): Promise<{ mine: TaskRow[]; given: TaskRow[] }> {
  const { rows } = await pool.query<{
    id: string
    title: string
    description: string | null
    priority: string
    due_date: string | null
    status: string
    assignee: string | null
    assigned_employee_id: string | null
    created_by: string | null
    created_by_employee_id: string | null
    created_at: string
  }>(
    `select t.id, t.title, t.description, t.priority, t.due_date::text, t.status, a.name as assignee,
            t.assigned_employee_id, c.name as created_by, t.created_by_employee_id, to_json(t.created_at)#>>'{}' as created_at
     from public.tasks t
     left join public.employees a on a.id = t.assigned_employee_id
     left join public.employees c on c.id = t.created_by_employee_id
     where t.assigned_employee_id = $1 or t.created_by_employee_id = $1
     order by (t.status in ('Completed', 'Cancelled')), t.due_date nulls last, t.created_at desc
     limit 300`,
    [employeeId]
  )
  const map = (r: (typeof rows)[number]): TaskRow => ({
    id: r.id,
    title: r.title,
    description: r.description,
    priority: r.priority,
    dueDate: r.due_date,
    status: r.status,
    assignee: r.assignee,
    assigneeId: r.assigned_employee_id,
    createdBy: r.created_by,
    createdAt: r.created_at,
  })
  return {
    mine: rows.filter((r) => r.assigned_employee_id === employeeId).map(map),
    given: rows.filter((r) => r.created_by_employee_id === employeeId && r.assigned_employee_id !== employeeId).map(map),
  }
}

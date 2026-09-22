import { pool } from "@/lib/db"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import type { CallListEntry } from "@/lib/types"
import { CallsClient } from "./calls-client"

interface EntryRow {
  id: string
  name: string | null
  phone: string
  notes: string | null
  status: CallListEntry["status"]
  last_called_at: string | null
  call_count: number
  created_at: string
  next_follow_up_date: string | null
  next_follow_up_time: string | null
}

interface HistoryRow {
  id: string
  outcome: string
  notes: string | null
  called_at: string
  phone: string
  name: string | null
}

export default async function CallsPage() {
  const currentEmployee = await getCurrentEmployee()

  const [entriesResult, historyResult] = await Promise.all([
    pool.query<EntryRow>(
      `select id, name, phone, notes, status, last_called_at::text, call_count, created_at::text,
              next_follow_up_date::text, next_follow_up_time::text
       from public.call_list_entries
       where owner_employee_id = $1
       order by next_follow_up_date asc nulls last, created_at desc`,
      [currentEmployee.id]
    ),
    pool.query<HistoryRow>(
      `select cl.id, cl.outcome, cl.notes, cl.called_at::text, e.phone, e.name
       from public.call_logs cl
       join public.call_list_entries e on e.id = cl.call_list_entry_id
       where cl.employee_id = $1
       order by cl.called_at desc
       limit 500`,
      [currentEmployee.id]
    ),
  ])

  const entries: CallListEntry[] = entriesResult.rows.map((e) => ({
    id: e.id,
    name: e.name,
    phone: e.phone,
    notes: e.notes,
    status: e.status,
    lastCalledAt: e.last_called_at,
    callCount: e.call_count,
    createdAt: e.created_at,
    nextFollowUpDate: e.next_follow_up_date,
    nextFollowUpTime: e.next_follow_up_time,
  }))

  return (
    <CallsClient
      initialEntries={entries}
      history={historyResult.rows.map((h) => ({
        id: h.id,
        outcome: h.outcome,
        notes: h.notes,
        calledAt: h.called_at,
        phone: h.phone,
        employeeName: h.name,
      }))}
    />
  )
}

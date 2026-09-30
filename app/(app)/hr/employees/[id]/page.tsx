import { notFound } from "next/navigation"
import { pool } from "@/lib/db"
import { decryptSecret } from "@/lib/crypto"
import {
  getAttendanceRows,
  getEmployeeAssets,
  getEmployeeDocuments,
  getEmployeeHistory,
  getEmployeeNotes,
  getEmployeeProfile,
  getLeaveRequests,
  getLeaveTypes,
  getOnboardingTasks,
  getOrgOptions,
} from "@/lib/data/hr"
import { getHrSettings, getLeaveBalances, requireHrManager } from "@/lib/hr/server"
import { officeDateKey } from "@/lib/hr/time"
import type { CredentialHistoryEntry, EmployeeCredential } from "@/lib/types"
import { ProfileClient } from "./profile-client"

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await requireHrManager()
  const profile = await getEmployeeProfile(id)
  if (!profile) notFound()

  const today = officeDateKey()
  const yearStart = `${today.slice(0, 4)}-01-01`
  const since = new Date(`${today}T00:00:00Z`)
  since.setUTCMonth(since.getUTCMonth() - 5)
  const attendanceStart = `${since.toISOString().slice(0, 7)}-01`

  const [org, documents, notes, history, tasks, assets, leave, leaveTypes, balances, settings, attendance, credRows, credHistory] =
    await Promise.all([
      getOrgOptions(),
      getEmployeeDocuments(id),
      getEmployeeNotes(id),
      getEmployeeHistory(id),
      getOnboardingTasks(id),
      getEmployeeAssets(id),
      getLeaveRequests(id),
      getLeaveTypes(),
      getLeaveBalances(id, Number(today.slice(0, 4))),
      getHrSettings(),
      getAttendanceRows(attendanceStart < yearStart ? attendanceStart : attendanceStart, today, id),
      pool.query<{ id: string; label: string; value_encrypted: string; updated_at: string; updated_by_name: string | null }>(
        `select c.id, c.label, c.value_encrypted, to_json(c.updated_at)#>>'{}' as updated_at, u.name as updated_by_name
         from public.employee_credentials c
         left join public.employees u on u.id = c.updated_by_employee_id
         where c.employee_id = $1 order by c.created_at`,
        [id]
      ),
      pool.query<{ id: string; label: string; action: CredentialHistoryEntry["action"]; changed_at: string; changed_by_name: string | null }>(
        `select h.id, h.label, h.action, to_json(h.changed_at)#>>'{}' as changed_at, e.name as changed_by_name
         from public.employee_credential_history h
         left join public.employees e on e.id = h.changed_by_employee_id
         where h.employee_id = $1 order by h.changed_at desc limit 100`,
        [id]
      ),
    ])

  const credentials: EmployeeCredential[] = credRows.rows.map((c) => ({
    id: c.id,
    label: c.label,
    value: decryptSecret(c.value_encrypted),
    updatedBy: c.updated_by_name,
    updatedAt: c.updated_at,
  }))
  const credentialHistory: CredentialHistoryEntry[] = credHistory.rows.map((h) => ({
    id: h.id,
    label: h.label,
    action: h.action,
    changedBy: h.changed_by_name,
    changedAt: h.changed_at,
  }))

  const months = Array.from(new Set([today.slice(0, 7), ...attendance.map((a) => a.workDate.slice(0, 7))])).sort().reverse()
  // Only the Owner may give or change the Owner role.
  const roles = me.role === "Owner" ? org.roles : org.roles.filter((r) => r.name !== "Owner")

  return (
    <ProfileClient
      profile={profile}
      org={{ ...org, roles, people: org.people.filter((p) => p.id !== id) }}
      canEditRole={me.role === "Owner" || profile.role !== "Owner"}
      isSelf={me.id === id}
      viewerIsOwner={me.role === "Owner"}
      documents={documents}
      notes={notes}
      history={history}
      tasks={tasks}
      assets={assets}
      leave={leave}
      leaveTypes={leaveTypes}
      balances={balances}
      settings={settings}
      attendance={attendance}
      months={months}
      credentials={credentials}
      credentialHistory={credentialHistory}
    />
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Briefcase, Building2, CalendarRange, Laptop, Phone, Users } from "@/components/icons"
import { EmployeeAvatar, EmployeeStatusBadge } from "@/components/hr/employee-bits"
import { AttendanceView } from "@/components/hr/attendance-view"
import { DocumentsPanel } from "@/components/hr/documents-panel"
import { HistoryList } from "@/components/hr/history-list"
import { ApplyLeaveDialog, LeaveBalances, LeaveRequestsCard } from "@/components/hr/leave-parts"
import { OnboardingChecklist, OnboardingProgress } from "@/components/hr/onboarding-parts"
import type { HrSettings } from "@/lib/hr/attendance"
import type { LeaveBalance } from "@/lib/hr/leave"
import type {
  AttendanceRow,
  EmployeeAsset,
  EmployeeDocument,
  EmployeeHistoryEntry,
  EmployeeNote,
  EmployeeProfile,
  LeaveRequestRow,
  OnboardingTask,
  OrgOptions,
} from "@/lib/hr/types"
import type { CredentialHistoryEntry, EmployeeCredential } from "@/lib/types"
import { formatDate, formatDateTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { CredentialsPanel } from "./credentials-panel"
import { DetailsPanel } from "./details-panel"

function NotesPanel({ employeeId, notes }: { employeeId: string; notes: EmployeeNote[] }) {
  const router = useRouter()
  const [text, setText] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/employees/${employeeId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? "Could not save the note.")
        return
      }
      setText("")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>HR notes</CardTitle>
        <CardDescription>Private to HR and the Owner — the employee never sees these.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Textarea rows={3} placeholder="Write a note… (performance, conversations, reminders)" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex items-center justify-end gap-3">
            {error ? <span className="text-sm text-destructive">{error}</span> : null}
            <Button className="cursor-pointer" disabled={!text.trim() || saving} onClick={add}>
              {saving ? "Saving…" : "Add note"}
            </Button>
          </div>
        </div>
        {notes.map((n) => (
          <div key={n.id} className="rounded-xl border bg-muted/30 p-3">
            <p className="text-sm whitespace-pre-wrap">{n.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {n.author ?? "Someone"} · {formatDateTime(n.createdAt)}
            </p>
          </div>
        ))}
        {notes.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No notes yet.</p> : null}
      </CardContent>
    </Card>
  )
}

function AssetsPanel({ assets }: { assets: EmployeeAsset[] }) {
  const current = assets.filter((a) => !a.returnedAt)
  const past = assets.filter((a) => a.returnedAt)
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Assets</CardTitle>
          <CardDescription>Company items with this employee right now, and earlier.</CardDescription>
        </div>
        <Button size="sm" variant="outline" className="cursor-pointer" nativeButton={false} render={<Link href="/hr/assets" />}>
          Give an asset
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {[...current, ...past].map((a) => (
          <div key={a.assignmentId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Laptop className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium">
                  {a.name} <span className="text-muted-foreground">· {a.assetTag}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.category} · given {formatDate(a.assignedAt)}
                  {a.returnedAt ? ` · returned ${formatDate(a.returnedAt)}` : ""}
                </p>
              </div>
            </div>
            <span
              className={
                a.returnedAt
                  ? "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600"
                  : "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
              }
            >
              {a.returnedAt ? "Returned" : "With employee"}
            </span>
          </div>
        ))}
        {assets.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No assets given yet.</p> : null}
      </CardContent>
    </Card>
  )
}

export function ProfileClient(props: {
  profile: EmployeeProfile
  org: OrgOptions
  canEditRole: boolean
  isSelf: boolean
  viewerIsOwner: boolean
  documents: EmployeeDocument[]
  notes: EmployeeNote[]
  history: EmployeeHistoryEntry[]
  tasks: OnboardingTask[]
  assets: EmployeeAsset[]
  leave: LeaveRequestRow[]
  leaveTypes: { id: string; name: string }[]
  balances: LeaveBalance[]
  settings: HrSettings
  attendance: AttendanceRow[]
  months: string[]
  credentials: EmployeeCredential[]
  credentialHistory: CredentialHistoryEntry[]
}) {
  const p = props.profile
  const onboarding = p.status === "Onboarding"
  const [tab, setTab] = useState(onboarding ? "onboarding" : "details")

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit cursor-pointer" nativeButton={false} render={<Link href="/hr/employees" />}>
        <ArrowLeft /> All employees
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <EmployeeAvatar name={p.name} photoUrl={p.photoUrl} className="size-16 text-lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight">{p.name}</h2>
                <EmployeeStatusBadge status={p.status} />
                {!p.active ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Login off</span> : null}
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono font-semibold text-foreground">{p.code}</span>
                {" · "}
                {p.designation ?? "No designation"}
                {" · "}
                {p.role}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="size-3.5" /> {[p.department, p.team].filter(Boolean).join(" · ") || "No department"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" /> Reports to {p.manager ?? "nobody"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarRange className="size-3.5" /> Joined {formatDate(p.joiningDate)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="size-3.5" /> {p.employmentType}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3.5" /> {p.contact}
                </span>
              </div>
            </div>
          </div>
          {onboarding && props.tasks.length > 0 ? (
            <div className="w-full sm:w-64">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Onboarding</p>
              <OnboardingProgress tasks={props.tasks} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="h-11 flex-wrap p-1">
          {[
            ["details", "Details"],
            ["documents", `Documents (${props.documents.length})`],
            ["attendance", "Attendance"],
            ["leave", "Leave"],
            ["onboarding", "Onboarding"],
            ["assets", "Assets"],
            ["notes", `Notes (${props.notes.length})`],
            ["history", "History"],
            ["logins", "Logins"],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="cursor-pointer px-3 py-1.5">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="details">
          <DetailsPanel profile={p} org={props.org} canEditRole={props.canEditRole} isSelf={props.isSelf} viewerIsOwner={props.viewerIsOwner} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsPanel employeeId={p.id} documents={props.documents} canDelete />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceView records={props.attendance} settings={props.settings} months={props.months} />
        </TabsContent>
        <TabsContent value="leave" className="flex flex-col gap-4">
          <div className="flex justify-end">
            <ApplyLeaveDialog leaveTypes={props.leaveTypes} employeeId={p.id} triggerLabel="Add leave for this employee" />
          </div>
          <LeaveBalances balances={props.balances} />
          <LeaveRequestsCard requests={props.leave} mode={props.isSelf ? "cancel" : "decide"} title="Leave requests" />
        </TabsContent>
        <TabsContent value="onboarding">
          <OnboardingChecklist employeeId={p.id} tasks={props.tasks} status={p.status} canEdit />
        </TabsContent>
        <TabsContent value="assets">
          <AssetsPanel assets={props.assets} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesPanel employeeId={p.id} notes={props.notes} />
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Employee history</CardTitle>
              <CardDescription>Joining, transfers, role and status changes, documents, leave — with who did it.</CardDescription>
            </CardHeader>
            <CardContent>
              <HistoryList entries={props.history} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="logins">
          <CredentialsPanel employeeId={p.id} credentials={props.credentials} history={props.credentialHistory} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

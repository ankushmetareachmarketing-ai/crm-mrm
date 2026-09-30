"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "@/components/icons"
import { Field, OptionSelect } from "@/components/hr/form-bits"
import type { LeaveBalance, LeaveStatus } from "@/lib/hr/leave"
import type { LeaveRequestRow } from "@/lib/hr/types"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

const LEAVE_STYLE: Record<LeaveStatus, string> = {
  Pending: "bg-amber-50 text-amber-800 border-amber-300",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-300",
  Rejected: "bg-rose-50 text-rose-700 border-rose-300",
  Cancelled: "bg-slate-100 text-slate-600 border-slate-200",
}

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold", LEAVE_STYLE[status])}>
      {status === "Pending" ? "Waiting for HR" : status}
    </span>
  )
}

export function leaveDates(r: { startDate: string; endDate: string; halfDay: boolean }) {
  if (r.startDate === r.endDate) return `${formatDate(r.startDate)}${r.halfDay ? " (half day)" : ""}`
  return `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`
}

export function LeaveBalances({ balances }: { balances: LeaveBalance[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {balances.map((b) => {
        const pct = b.allowed ? Math.min(100, (b.used / b.allowed) * 100) : 0
        return (
          <Card key={b.leaveTypeId} className="gap-2">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{b.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-2xl font-bold">
                {b.remaining === null ? "No limit" : b.remaining}
                {b.remaining !== null ? <span className="text-sm font-normal text-muted-foreground"> left of {b.allowed}</span> : null}
              </p>
              {b.allowed ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {b.used} used{b.pending > 0 ? ` · ${b.pending} waiting` : ""}
                {!b.paid ? " · unpaid" : ""}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/** Dialog to apply for leave. HR passes employeeId to file it for someone else. */
export function ApplyLeaveDialog({
  leaveTypes,
  employeeId,
  triggerLabel = "Apply for leave",
}: {
  leaveTypes: { id: string; name: string }[]
  employeeId?: string
  triggerLabel?: string
}) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const empty = { leaveTypeId: leaveTypes[0]?.id ?? "", startDate: today, endDate: today, halfDay: false, reason: "" }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, employeeId }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? "Could not send the request.")
        return
      }
      setOpen(false)
      setForm(empty)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null) }}>
      <DialogTrigger render={<Button className="cursor-pointer" />}>
        <Plus /> {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Apply for leave</DialogTitle>
          <DialogDescription>HR is notified and will approve or reject it. Weekly offs are not counted.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Leave type" htmlFor="lv-type">
            <OptionSelect id="lv-type" value={form.leaveTypeId} onChange={(v) => setForm((f) => ({ ...f, leaveTypeId: v }))} options={leaveTypes} placeholder="Select" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="lv-from">
              <Input
                id="lv-from"
                type="date"
                className="h-10 text-base"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate }))}
              />
            </Field>
            <Field label="To" htmlFor="lv-to">
              <Input
                id="lv-to"
                type="date"
                min={form.startDate}
                className="h-10 text-base"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value, halfDay: e.target.value === f.startDate && f.halfDay }))}
              />
            </Field>
          </div>
          {form.startDate === form.endDate ? (
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <Switch checked={form.halfDay} onCheckedChange={(v) => setForm((f) => ({ ...f, halfDay: Boolean(v) }))} />
              Half day only
            </label>
          ) : null}
          <Field label="Reason" htmlFor="lv-reason">
            <Textarea id="lv-reason" rows={3} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="cursor-pointer" onClick={submit} disabled={saving || !form.leaveTypeId}>
            {saving ? "Sending…" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Approve / reject (HR) or cancel (own pending) buttons for a leave request. */
export function LeaveActions({ request, mode }: { request: LeaveRequestRow; mode: "decide" | "cancel" }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (request.status !== "Pending") return null

  async function act(action: "approve" | "reject" | "cancel") {
    let note = ""
    if (action === "reject") {
      const input = window.prompt("Reason for rejecting (optional):")
      if (input === null) return
      note = input
    }
    if (action === "cancel" && !window.confirm("Cancel this leave request?")) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/leave/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? "Could not save.")
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        {mode === "decide" ? (
          <>
            <Button size="sm" variant="outline" className="cursor-pointer" disabled={busy} onClick={() => act("reject")}>
              Reject
            </Button>
            <Button size="sm" className="cursor-pointer" disabled={busy} onClick={() => act("approve")}>
              Approve
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" className="cursor-pointer" disabled={busy} onClick={() => act("cancel")}>
            Cancel
          </Button>
        )}
      </div>
      {error ? <p className="max-w-56 text-right text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export function LeaveRequestsCard({
  requests,
  mode,
  title,
  description,
  showEmployee,
}: {
  requests: LeaveRequestRow[]
  mode: "decide" | "cancel" | "none"
  title: string
  description?: string
  showEmployee?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {requests.map((r) => (
          <div
            key={r.id}
            className={cn(
              "flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
              r.status === "Pending" && "border-amber-200 bg-amber-50/40"
            )}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {showEmployee ? <span className="text-sm font-semibold">{r.employee}</span> : null}
                <span className="text-sm font-medium">{r.leaveType}</span>
                <LeaveStatusBadge status={r.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {leaveDates(r)} · {r.days} day{r.days === 1 ? "" : "s"}
              </p>
              {r.reason ? <p className="text-xs text-muted-foreground">“{r.reason}”</p> : null}
              {r.decidedBy ? (
                <p className="text-xs text-muted-foreground">
                  {r.status} by {r.decidedBy}
                  {r.decisionNote ? ` — ${r.decisionNote}` : ""}
                </p>
              ) : null}
            </div>
            {mode !== "none" ? <LeaveActions request={r} mode={mode} /> : null}
          </div>
        ))}
        {requests.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No leave requests.</p> : null}
      </CardContent>
    </Card>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Plus, Trash2 } from "@/components/icons"
import type { OnboardingTask, PolicyRow } from "@/lib/hr/types"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function OnboardingProgress({ tasks }: { tasks: OnboardingTask[] }) {
  const done = tasks.filter((t) => t.doneAt).length
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", pct === 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold whitespace-nowrap">
        {done}/{tasks.length} done
      </span>
    </div>
  )
}

/** Onboarding checklist. HR can tick, add and remove steps, and activate the employee. */
export function OnboardingChecklist({
  employeeId,
  tasks,
  status,
  canEdit,
}: {
  employeeId: string
  tasks: OnboardingTask[]
  status: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [newTask, setNewTask] = useState("")
  const [error, setError] = useState<string | null>(null)
  const allDone = tasks.length > 0 && tasks.every((t) => t.doneAt)

  async function call(key: string, url: string, init: RequestInit) {
    setBusy(key)
    setError(null)
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? "Could not save.")
        return false
      }
      router.refresh()
      return true
    } finally {
      setBusy(null)
    }
  }

  async function activate(nextStatus: "Probation" | "Active") {
    if (!allDone && !window.confirm("Some steps are not done yet. Activate anyway?")) return
    await call("activate", `/api/hr/onboarding/${employeeId}`, {
      method: "POST",
      body: JSON.stringify({ action: "activate", status: nextStatus }),
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Onboarding checklist</CardTitle>
          <CardDescription>
            {status === "Onboarding"
              ? "Finish these steps, then activate the employee to switch on their login."
              : "Joining steps for this employee."}
          </CardDescription>
        </div>
        {canEdit && tasks.length === 0 ? (
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer"
            disabled={busy !== null}
            onClick={() => call("start", `/api/hr/onboarding/${employeeId}`, { method: "POST", body: JSON.stringify({ action: "start" }) })}
          >
            Start onboarding
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {tasks.length > 0 ? <OnboardingProgress tasks={tasks} /> : null}
        <ul className="flex flex-col gap-1.5">
          {tasks.map((t) => (
            <li
              key={t.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                t.doneAt ? "border-emerald-200 bg-emerald-50/50" : "bg-card"
              )}
            >
              <button
                type="button"
                disabled={!canEdit || busy !== null}
                aria-label={t.doneAt ? "Mark not done" : "Mark done"}
                onClick={() =>
                  call(t.id, `/api/hr/onboarding/tasks/${t.id}`, { method: "PATCH", body: JSON.stringify({ done: !t.doneAt }) })
                }
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  t.doneAt ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300",
                  canEdit && "cursor-pointer hover:border-primary"
                )}
              >
                {t.doneAt ? <CheckCircle2 className="size-4" /> : null}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", t.doneAt && "text-muted-foreground line-through")}>{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t.category}
                  {t.doneAt ? ` · done ${formatDate(t.doneAt)}${t.doneBy ? ` by ${t.doneBy}` : ""}` : ""}
                </p>
              </div>
              {canEdit ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  aria-label="Remove step"
                  disabled={busy !== null}
                  onClick={() => window.confirm("Remove this step?") && call(t.id, `/api/hr/onboarding/tasks/${t.id}`, { method: "DELETE" })}
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {tasks.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No onboarding steps.</p> : null}

        {canEdit && tasks.length > 0 ? (
          <div className="flex gap-2">
            <Input placeholder="Add another step…" className="h-10" value={newTask} onChange={(e) => setNewTask(e.target.value)} />
            <Button
              variant="outline"
              className="h-10 cursor-pointer"
              disabled={!newTask.trim() || busy !== null}
              onClick={async () => {
                const ok = await call("add", `/api/hr/onboarding/${employeeId}`, {
                  method: "POST",
                  body: JSON.stringify({ action: "addTask", title: newTask }),
                })
                if (ok) setNewTask("")
              }}
            >
              <Plus /> Add
            </Button>
          </div>
        ) : null}

        {canEdit && status === "Onboarding" ? (
          <div className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Ready to activate?</p>
              <p className="text-xs text-muted-foreground">Turns on their login and moves them out of onboarding.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="cursor-pointer" disabled={busy !== null} onClick={() => activate("Probation")}>
                Activate on probation
              </Button>
              <Button className="cursor-pointer" disabled={busy !== null} onClick={() => activate("Active")}>
                Activate
              </Button>
            </div>
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}

/** Company policies for the signed-in employee to read and accept. */
export function PoliciesToAccept({ policies }: { policies: PolicyRow[] }) {
  const router = useRouter()
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function accept(id: string) {
    setBusy(id)
    try {
      const res = await fetch(`/api/policies/${id}/acknowledge`, { method: "POST" })
      if (res.ok) router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company policies</CardTitle>
        <CardDescription>Please read each policy and press “I have read this”.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {policies.map((p) => (
          <div key={p.id} className={cn("rounded-xl border p-3", !p.acknowledgedAt && "border-amber-200 bg-amber-50/40")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" className="cursor-pointer text-left text-sm font-semibold hover:underline" onClick={() => setOpen(open === p.id ? null : p.id)}>
                {p.title}
              </button>
              {p.acknowledgedAt ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="size-4" /> Accepted {formatDate(p.acknowledgedAt)}
                </span>
              ) : (
                <Button size="sm" className="cursor-pointer" disabled={busy === p.id} onClick={() => accept(p.id)}>
                  I have read this
                </Button>
              )}
            </div>
            {open === p.id || !p.acknowledgedAt ? (
              <p className="mt-2 max-h-60 overflow-y-auto text-sm whitespace-pre-wrap text-muted-foreground">{p.body}</p>
            ) : null}
          </div>
        ))}
        {policies.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No policies yet.</p> : null}
      </CardContent>
    </Card>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, ListChecks, Plus } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { Field, OptionSelect, TextSelect } from "@/components/hr/form-bits"
import type { TaskRow } from "@/lib/data/me"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const PRIORITY_STYLE: Record<string, string> = {
  Urgent: "bg-rose-600 text-white",
  High: "bg-orange-100 text-orange-800",
  Medium: "bg-slate-100 text-slate-700",
  Low: "bg-slate-50 text-slate-500",
}

function TaskItem({ t, showAssignee }: { t: TaskRow; showAssignee?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const done = t.status === "Completed"
  const today = new Date().toISOString().slice(0, 10)
  const overdue = !done && t.status !== "Cancelled" && t.dueDate !== null && t.dueDate < today

  async function setStatus(status: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/tasks/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-3", done && "opacity-60", overdue && "border-rose-200 bg-rose-50/40")}>
      <button
        type="button"
        disabled={busy || showAssignee}
        aria-label={done ? "Mark not done" : "Mark done"}
        onClick={() => setStatus(done ? "Pending" : "Completed")}
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
          done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300",
          !showAssignee && "cursor-pointer hover:border-primary"
        )}
      >
        {done ? <CheckCircle2 className="size-4" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("text-sm font-semibold", done && "line-through")}>{t.title}</p>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", PRIORITY_STYLE[t.priority])}>{t.priority}</span>
          {t.status === "In Progress" ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">In progress</span> : null}
        </div>
        {t.description ? <p className="text-sm text-muted-foreground">{t.description}</p> : null}
        <p className={cn("text-xs text-muted-foreground", overdue && "font-semibold text-rose-700")}>
          {showAssignee ? `For ${t.assignee ?? "—"}` : `From ${t.createdBy ?? "—"}`}
          {t.dueDate ? ` · ${overdue ? "was due" : "due"} ${formatDate(t.dueDate)}` : ""}
        </p>
      </div>
      {!showAssignee && t.status === "Pending" ? (
        <Button size="sm" variant="outline" className="cursor-pointer" disabled={busy} onClick={() => setStatus("In Progress")}>
          Start
        </Button>
      ) : null}
    </div>
  )
}

export function MyTasksClient({ mine, given, team }: { mine: TaskRow[]; given: TaskRow[]; team: { id: string; name: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: "", description: "", assigneeId: "", priority: "Medium", dueDate: "" })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const openCount = mine.filter((t) => t.status === "Pending" || t.status === "In Progress").length

  async function create() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Could not save.")
        return
      }
      setOpen(false)
      setForm({ title: "", description: "", assigneeId: "", priority: "Medium", dueDate: "" })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My tasks"
        description={openCount > 0 ? `${openCount} open task${openCount === 1 ? "" : "s"}. Tick one when it's done.` : "You're all caught up."}
        actions={
          team.length > 0 ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button className="cursor-pointer" />}>
                <Plus /> Give a task
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-lg">Give a task</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                  <Field label="For" htmlFor="tk-for" required>
                    <OptionSelect id="tk-for" value={form.assigneeId} onChange={(v) => setForm({ ...form, assigneeId: v })} options={team} placeholder="Select employee" />
                  </Field>
                  <Field label="Task" htmlFor="tk-title" required>
                    <Input id="tk-title" className="h-10 text-base" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </Field>
                  <Field label="Details" htmlFor="tk-desc">
                    <Textarea id="tk-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Priority" htmlFor="tk-pri">
                      <TextSelect id="tk-pri" value={form.priority} onChange={(v) => setForm({ ...form, priority: v || "Medium" })} options={["Low", "Medium", "High", "Urgent"]} placeholder="Select" />
                    </Field>
                    <Field label="Due date" htmlFor="tk-due">
                      <Input id="tk-due" type="date" className="h-10 text-base" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                    </Field>
                  </div>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                </div>
                <DialogFooter>
                  <Button variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button className="cursor-pointer" disabled={saving || !form.title.trim() || !form.assigneeId} onClick={create}>
                    {saving ? "Saving…" : "Give task"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Given to me</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {mine.map((t) => (
            <TaskItem key={t.id} t={t} />
          ))}
          {mine.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <ListChecks className="size-7" />
              No tasks for you.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {given.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Given by me</CardTitle>
            <CardDescription>You get a notification when they finish.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {given.map((t) => (
              <TaskItem key={t.id} t={t} showAssignee />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookOpen, ChevronRight, Pencil, Plus, UserPlus } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { EmployeeAvatar, EmployeeStatusBadge } from "@/components/hr/employee-bits"
import { Field } from "@/components/hr/form-bits"
import type { EmployeeSummary, PolicyRow } from "@/lib/hr/types"
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
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

type Joiner = EmployeeSummary & { progress: { total: number; done: number } }

export function OnboardingClient({
  joiners,
  policies,
  activeEmployees,
}: {
  joiners: Joiner[]
  policies: PolicyRow[]
  activeEmployees: number
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<{ id: string | null; title: string; body: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function savePolicy() {
    if (!editing) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(editing.id ? `/api/hr/policies/${editing.id}` : "/api/hr/policies", {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editing.title, body: editing.body }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Could not save.")
        return
      }
      setEditing(null)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function toggle(p: PolicyRow) {
    const res = await fetch(`/api/hr/policies/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    })
    if (res.ok) router.refresh()
  }

  const onboarding = joiners.filter((j) => j.status === "Onboarding")
  const probation = joiners.filter((j) => j.status === "Probation")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Onboarding"
        description="New joiners, their checklist progress, and the company policies everyone must accept."
        actions={
          <Button className="cursor-pointer" nativeButton={false} render={<Link href="/hr/employees/new" />}>
            <UserPlus /> Add new joiner
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Joining now</CardTitle>
          <CardDescription>Open someone to tick off steps, and activate them when done.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {onboarding.map((j) => {
            const pct = j.progress.total ? Math.round((j.progress.done / j.progress.total) * 100) : 0
            return (
              <Link key={j.id} href={`/hr/employees/${j.id}`} className="flex flex-col gap-3 rounded-xl border p-3 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <EmployeeAvatar name={j.name} photoUrl={j.photoUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{j.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {j.code} · {j.designation ?? j.role} · joins {formatDate(j.joiningDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:w-72">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", pct === 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {j.progress.done}/{j.progress.total}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </Link>
            )
          })}
          {onboarding.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nobody is onboarding right now.</p> : null}
        </CardContent>
      </Card>

      {probation.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>On probation</CardTitle>
            <CardDescription>Change their status to Active from their profile when probation ends.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {probation.map((j) => (
              <Link key={j.id} href={`/hr/employees/${j.id}`} className="flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm hover:bg-accent">
                <EmployeeAvatar name={j.name} photoUrl={j.photoUrl} className="size-7" />
                {j.name}
                <EmployeeStatusBadge status={j.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Company policies</CardTitle>
            <CardDescription>Everyone is notified and asked to accept a new policy. Editing the text asks them again.</CardDescription>
          </div>
          <Button className="cursor-pointer" onClick={() => { setError(null); setEditing({ id: null, title: "", body: "" }) }}>
            <Plus /> Add policy
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {policies.map((p) => (
            <div key={p.id} className={cn("flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between", !p.active && "opacity-60")}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BookOpen className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Accepted by {p.acknowledgedCount} of {activeEmployees} · updated {formatDate(p.updatedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={p.active} onCheckedChange={() => toggle(p)} /> {p.active ? "Active" : "Off"}
                </label>
                <Button variant="ghost" size="icon-sm" className="cursor-pointer" aria-label="Edit" onClick={() => { setError(null); setEditing({ id: p.id, title: p.title, body: p.body }) }}>
                  <Pencil />
                </Button>
              </div>
            </div>
          ))}
          {policies.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No policies yet — add leave, attendance or conduct rules here.</p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">{editing?.id ? "Edit policy" : "Add policy"}</DialogTitle>
            <DialogDescription>Written in plain words. Every active employee will be asked to accept it.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <div className="flex flex-col gap-4">
              <Field label="Title" htmlFor="pol-title" required>
                <Input id="pol-title" className="h-10 text-base" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. Leave & attendance policy" />
              </Field>
              <Field label="Policy text" htmlFor="pol-body" required>
                <Textarea id="pol-body" rows={10} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
              </Field>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button className="cursor-pointer" disabled={saving || !editing?.title.trim() || !editing?.body.trim()} onClick={savePolicy}>
              {saving ? "Saving…" : "Save & notify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Building2, ChevronDown, ChevronRight, Hierarchy, Pencil, Plus, Trash2, Users } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { SearchField } from "@/components/search-field"
import { StatCard } from "@/components/stat-card"
import { EmployeeAvatar, EmployeeStatusBadge } from "@/components/hr/employee-bits"
import { Field, OptionSelect } from "@/components/hr/form-bits"
import type { EmployeeSummary, OrgOptions } from "@/lib/hr/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type Kind = "departments" | "designations" | "teams"
const LABEL: Record<Kind, string> = { departments: "Department", designations: "Designation", teams: "Team" }

interface Editing {
  kind: Kind
  id: string | null
  name: string
  description: string
  departmentId: string
  personId: string
}

const WORKING = ["Onboarding", "Probation", "Active", "Notice Period"]

function matchesEmployee(person: EmployeeSummary, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  return !normalizedQuery ||
    [person.name, person.code, person.department, person.designation, person.manager]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery))
}

function treeHasMatch(
  person: EmployeeSummary,
  reportsOf: Map<string | null, EmployeeSummary[]>,
  query: string
): boolean {
  return matchesEmployee(person, query) || (reportsOf.get(person.id) ?? []).some((child) => treeHasMatch(child, reportsOf, query))
}

/** Everyone who reports (directly or not) to the given person, as a tree. */
function OrgNode({
  person,
  reportsOf,
  depth,
  query,
}: {
  person: EmployeeSummary
  reportsOf: Map<string | null, EmployeeSummary[]>
  depth: number
  query: string
}) {
  const children = (reportsOf.get(person.id) ?? []).filter((child) => treeHasMatch(child, reportsOf, query))
  const [open, setOpen] = useState(depth < 2)
  const expanded = query.trim() ? true : open
  return (
    <li className="relative">
      <div className="flex items-center gap-2 py-1">
        {children.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            disabled={Boolean(query.trim())}
            className="flex size-6 cursor-pointer items-center justify-center rounded-md hover:bg-accent"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="size-6" />
        )}
        <Link href={`/hr/employees/${person.id}`} className="flex min-w-0 items-center gap-3 rounded-xl border bg-card px-3 py-2 transition-colors hover:bg-accent/50">
          <EmployeeAvatar name={person.name} photoUrl={person.photoUrl} className="size-8" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{person.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {person.designation ?? person.role}
              {person.department ? ` · ${person.department}` : ""}
            </p>
          </div>
          {children.length > 0 ? (
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{children.length}</span>
          ) : null}
        </Link>
      </div>
      {expanded && children.length > 0 ? (
        <ul className="ml-3 border-l-2 border-border pl-5">
          {children.map((c) => (
            <OrgNode key={c.id} person={c} reportsOf={reportsOf} depth={depth + 1} query={query} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function OrganizationClient({ org, employees }: { org: OrgOptions; employees: EmployeeSummary[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<Editing | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const working = employees.filter((e) => WORKING.includes(e.status))
  const nameOf = (id: string | null) => (id ? employees.find((e) => e.id === id)?.name ?? "—" : "—")
  const deptName = (id: string | null) => (id ? org.departments.find((d) => d.id === id)?.name ?? "—" : "Any department")

  // Org chart: people whose manager isn't a working employee are at the top.
  const reportsOf = useMemo(() => {
    const ids = new Set(working.map((e) => e.id))
    const map = new Map<string | null, EmployeeSummary[]>()
    for (const e of working) {
      const key = e.managerId && ids.has(e.managerId) ? e.managerId : null
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return map
  }, [working])

  function openEdit(kind: Kind, item?: { id: string; name: string; description?: string | null; departmentId?: string | null; person?: string | null }) {
    setError(null)
    setEditing({
      kind,
      id: item?.id ?? null,
      name: item?.name ?? "",
      description: item?.description ?? "",
      departmentId: item?.departmentId ?? "",
      personId: item?.person ?? "",
    })
  }

  async function save() {
    if (!editing) return
    setSaving(true)
    setError(null)
    const body: Record<string, string> = { name: editing.name }
    if (editing.kind === "departments") {
      body.description = editing.description
      body.headEmployeeId = editing.personId
    } else {
      body.departmentId = editing.departmentId
      if (editing.kind === "teams") body.leadEmployeeId = editing.personId
    }
    try {
      const res = await fetch(`/api/hr/org/${editing.kind}${editing.id ? `/${editing.id}` : ""}`, {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  async function remove(kind: Kind, id: string, name: string) {
    if (!window.confirm(`Delete ${LABEL[kind].toLowerCase()} "${name}"? Employees in it are kept, just unassigned.`)) return
    const res = await fetch(`/api/hr/org/${kind}/${id}`, { method: "DELETE" })
    if (res.ok) router.refresh()
  }

  const rowActions = (kind: Kind, item: Parameters<typeof openEdit>[1] & { id: string; name: string }) => (
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size="icon-sm" className="cursor-pointer" aria-label="Edit" onClick={() => openEdit(kind, item)}>
        <Pencil />
      </Button>
      <Button variant="ghost" size="icon-sm" className="cursor-pointer" aria-label="Delete" onClick={() => remove(kind, item.id, item.name)}>
        <Trash2 className="text-destructive" />
      </Button>
    </div>
  )

  const normalizedQuery = query.trim().toLowerCase()
  const visibleDepartments = org.departments.filter((department) =>
    !normalizedQuery || department.name.toLowerCase().includes(normalizedQuery) ||
    working.some((person) => person.departmentId === department.id && matchesEmployee(person, query))
  )
  const unassigned = working.filter((employee) => !employee.departmentId && matchesEmployee(employee, query))
  const visibleRoots = (reportsOf.get(null) ?? []).filter((person) => treeHasMatch(person, reportsOf, query))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Organization" description="Departments, designations, teams and who reports to whom." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Departments" value={String(org.departments.length)} icon={Building2} />
        <StatCard label="Designations" value={String(org.designations.length)} icon={Pencil} />
        <StatCard label="Teams" value={String(org.teams.length)} icon={Users} />
        <StatCard label="Without a department" value={String(unassigned.length)} icon={Hierarchy} hint="Working employees" />
      </div>

      <Tabs defaultValue="departments">
        <TabsList className="h-11 p-1">
          <TabsTrigger value="departments" className="cursor-pointer px-4">Departments</TabsTrigger>
          <TabsTrigger value="designations" className="cursor-pointer px-4">Designations</TabsTrigger>
          <TabsTrigger value="teams" className="cursor-pointer px-4">Teams</TabsTrigger>
          <TabsTrigger value="chart" className="cursor-pointer px-4">Org chart</TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="flex flex-col gap-4">
          <SearchField
            className="w-full sm:max-w-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employees or departments…"
          />
          <div className="flex justify-end">
            <Button className="cursor-pointer" onClick={() => openEdit("departments")}>
              <Plus /> Add department
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleDepartments.map((d) => {
              const people = working.filter((e) => e.departmentId === d.id && matchesEmployee(e, query))
              return (
                <Card key={d.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {d.name}
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{people.length}</span>
                      </CardTitle>
                      <CardDescription>
                        Head: {nameOf(d.headEmployeeId)}
                        {d.description ? ` · ${d.description}` : ""}
                      </CardDescription>
                    </div>
                    {rowActions("departments", { id: d.id, name: d.name, description: d.description, person: d.headEmployeeId })}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1.5">
                    {people.map((e) => (
                      <Link key={e.id} href={`/hr/employees/${e.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/50">
                        <span className="flex min-w-0 items-center gap-2">
                          <EmployeeAvatar name={e.name} photoUrl={e.photoUrl} className="size-7" />
                          <span className="truncate text-sm font-medium">{e.name}</span>
                          <span className="truncate text-xs text-muted-foreground">{e.designation ?? ""}</span>
                        </span>
                        <EmployeeStatusBadge status={e.status} />
                      </Link>
                    ))}
                    {people.length === 0 ? <p className="py-2 text-sm text-muted-foreground">Nobody in this department yet.</p> : null}
                  </CardContent>
                </Card>
              )
            })}
          </div>
          {visibleDepartments.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {normalizedQuery ? "No departments or employees match your search." : "No departments yet. Add one — e.g. Sales, HR, Operations, Support."}
              </CardContent>
            </Card>
          ) : null}
          {unassigned.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Not in any department</CardTitle>
                <CardDescription>Open an employee to set their department.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {unassigned.map((e) => (
                  <Link key={e.id} href={`/hr/employees/${e.id}`} className="rounded-full border px-3 py-1 text-sm hover:bg-accent">
                    {e.name}
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {(["designations", "teams"] as const).map((kind) => {
          const items = kind === "designations" ? org.designations : org.teams
          const visibleItems = items.filter((item) => {
            if (!normalizedQuery) return true
            const peopleMatch = working.some((person) =>
              (kind === "designations" ? person.designationId : person.teamId) === item.id && matchesEmployee(person, query)
            )
            const lead = kind === "teams" ? (item as OrgOptions["teams"][number]).leadEmployeeId : null
            return item.name.toLowerCase().includes(normalizedQuery) ||
              deptName(item.departmentId).toLowerCase().includes(normalizedQuery) ||
              (lead ? nameOf(lead).toLowerCase().includes(normalizedQuery) : false) || peopleMatch
          })
          return (
            <TabsContent key={kind} value={kind} className="flex flex-col gap-4">
                <SearchField
                  className="w-full sm:max-w-sm"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${kind} and employees…`}
                />
              <div className="flex justify-end">
                <Button className="cursor-pointer" onClick={() => openEdit(kind)}>
                  <Plus /> Add {LABEL[kind].toLowerCase()}
                </Button>
              </div>
              <Card>
                <CardContent className="flex flex-col gap-1.5">
                  {visibleItems.map((item) => {
                    const count = working.filter((e) => (kind === "designations" ? e.designationId : e.teamId) === item.id).length
                    const lead = kind === "teams" ? (item as OrgOptions["teams"][number]).leadEmployeeId : null
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-semibold">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {deptName(item.departmentId)} · {count} {count === 1 ? "person" : "people"}
                            {kind === "teams" ? ` · Lead: ${nameOf(lead)}` : ""}
                          </p>
                        </div>
                        {rowActions(kind, { id: item.id, name: item.name, departmentId: item.departmentId, person: lead })}
                      </div>
                    )
                  })}
                  {visibleItems.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {normalizedQuery ? `No ${kind} match your search.` : `No ${kind} yet.`}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}

        <TabsContent value="chart">
          <Card>
            <CardHeader>
              <CardTitle>Org chart</CardTitle>
              <CardDescription>Built from each employee&apos;s reporting manager. Click a name to open their profile.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SearchField
                className="w-full sm:max-w-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search org chart by employee, role, department…"
              />
              <ul className="flex flex-col gap-1">
                {visibleRoots.map((p) => (
                  <OrgNode key={p.id} person={p} reportsOf={reportsOf} depth={0} query={query} />
                ))}
              </ul>
              {visibleRoots.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {normalizedQuery ? "No employees match your search." : "No employees yet."}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editing?.id ? "Edit" : "Add"} {editing ? LABEL[editing.kind].toLowerCase() : ""}
            </DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="flex flex-col gap-4">
              <Field label="Name" htmlFor="org-name" required>
                <Input id="org-name" className="h-10 text-base" autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              {editing.kind === "departments" ? (
                <>
                  <Field label="Department head" htmlFor="org-head">
                    <OptionSelect id="org-head" value={editing.personId} onChange={(v) => setEditing({ ...editing, personId: v })} options={org.people} placeholder="Select" noneLabel="No head" />
                  </Field>
                  <Field label="Description" htmlFor="org-desc">
                    <Textarea id="org-desc" rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                  </Field>
                </>
              ) : (
                <Field label="Department" htmlFor="org-dept" hint="Leave empty if it's used across departments.">
                  <OptionSelect id="org-dept" value={editing.departmentId} onChange={(v) => setEditing({ ...editing, departmentId: v })} options={org.departments} placeholder="Select" noneLabel="Any department" />
                </Field>
              )}
              {editing.kind === "teams" ? (
                <Field label="Team lead" htmlFor="org-lead">
                  <OptionSelect id="org-lead" value={editing.personId} onChange={(v) => setEditing({ ...editing, personId: v })} options={org.people} placeholder="Select" noneLabel="No lead" />
                </Field>
              ) : null}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button className={cn("cursor-pointer")} disabled={saving || !editing?.name.trim()} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

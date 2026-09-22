"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, KeyRound, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { formatRelativeTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface CredentialRow {
  id: string
  employeeId: string
  employeeName: string
  label: string
  value: string
  updatedAt: string
  updatedBy: string | null
}

const emptyAddForm = { employeeId: "", label: "", value: "" }

export function PasswordManagerClient({
  credentials: initialCredentials,
  employees,
}: {
  credentials: CredentialRow[]
  employees: { id: string; name: string }[]
}) {
  const [credentials, setCredentials] = useState(initialCredentials)
  const [query, setQuery] = useState("")
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(emptyAddForm)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [editing, setEditing] = useState<CredentialRow | null>(null)
  const [editForm, setEditForm] = useState({ label: "", value: "" })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return credentials
    return credentials.filter(
      (c) => c.employeeName.toLowerCase().includes(q) || c.label.toLowerCase().includes(q)
    )
  }, [credentials, query])

  async function handleAdd() {
    if (!addForm.employeeId || !addForm.label.trim() || !addForm.value.trim()) {
      setAddError("Employee, label and value are all required.")
      return
    }
    setAddSubmitting(true)
    setAddError(null)
    try {
      const res = await fetch(`/api/employees/${addForm.employeeId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: addForm.label, value: addForm.value }),
      })
      const body = await res.json()
      if (!res.ok) {
        setAddError(body.error ?? "Could not add this credential.")
        return
      }
      const employeeName = employees.find((e) => e.id === addForm.employeeId)?.name ?? ""
      setCredentials((prev) => [{ ...body, employeeId: addForm.employeeId, employeeName }, ...prev])
      setAddForm(emptyAddForm)
      setAddOpen(false)
    } finally {
      setAddSubmitting(false)
    }
  }

  function openEdit(c: CredentialRow) {
    setEditing(c)
    setEditForm({ label: c.label, value: c.value })
    setEditError(null)
  }

  async function handleSaveEdit() {
    if (!editing) return
    if (!editForm.label.trim() || !editForm.value.trim()) {
      setEditError("Label and value are both required.")
      return
    }
    setEditSubmitting(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/employees/${editing.employeeId}/credentials/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      const body = await res.json()
      if (!res.ok) {
        setEditError(body.error ?? "Could not save this credential.")
        return
      }
      setCredentials((prev) =>
        prev.map((c) => (c.id === editing.id ? { ...c, label: body.label, value: body.value, updatedAt: body.updatedAt, updatedBy: body.updatedBy } : c))
      )
      setEditing(null)
    } finally {
      setEditSubmitting(false)
    }
  }

  async function handleDelete(c: CredentialRow) {
    setDeletingId(c.id)
    try {
      const res = await fetch(`/api/employees/${c.employeeId}/credentials/${c.id}`, { method: "DELETE" })
      if (!res.ok) return
      setCredentials((prev) => prev.filter((x) => x.id !== c.id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Password Manager"
        description="Every laptop, Google account or other credential issued to an employee, in one place."
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus /> Add credential
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-lg">Add credential</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-1">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pm-employee">Employee</Label>
                  <Select value={addForm.employeeId} onValueChange={(v) => setAddForm((f) => ({ ...f, employeeId: v ?? "" }))}>
                    <SelectTrigger id="pm-employee" className="h-10 w-full text-base">
                      <SelectValue placeholder="Select employee">
                        {(v: string) => employees.find((e) => e.id === v)?.name ?? "Select employee"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pm-label">Label</Label>
                  <Input
                    id="pm-label"
                    className="h-10 text-base"
                    value={addForm.label}
                    onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="e.g. Laptop password, Google account"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pm-value">Value</Label>
                  <Input
                    id="pm-value"
                    className="h-10 text-base font-mono"
                    value={addForm.value}
                    onChange={(e) => setAddForm((f) => ({ ...f, value: e.target.value }))}
                  />
                </div>
                {addError ? <p className="text-sm text-destructive">{addError}</p> : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={addSubmitting}>
                  {addSubmitting ? "Adding…" : "Add credential"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by employee or label…"
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/hr/employees/${c.employeeId}`} className="font-medium hover:underline">
                      {c.employeeName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{c.label}</TableCell>
                  <TableCell className="max-w-56 truncate font-mono text-sm text-muted-foreground">
                    {revealed[c.id] ? c.value : "•".repeat(Math.min(c.value.length, 14))}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRelativeTime(c.updatedAt)}
                    {c.updatedBy ? ` by ${c.updatedBy}` : ""}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setRevealed((r) => ({ ...r, [c.id]: !r[c.id] }))}
                      >
                        {revealed[c.id] ? <EyeOff /> : <Eye />}
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={deletingId === c.id}
                        onClick={() => handleDelete(c)}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <KeyRound className="size-6" />
                      No credentials match your search.
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Edit credential — {editing?.employeeName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pm-edit-label">Label</Label>
              <Input
                id="pm-edit-label"
                className="h-10 text-base"
                value={editForm.label}
                onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pm-edit-value">Value</Label>
              <Input
                id="pm-edit-value"
                className="h-10 text-base font-mono"
                value={editForm.value}
                onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
              />
            </div>
            {editError ? <p className="text-sm text-destructive">{editError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editSubmitting}>
              {editSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

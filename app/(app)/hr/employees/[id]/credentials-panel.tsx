"use client"

import { useState } from "react"
import { Eye, EyeOff, KeyRound, Pencil, Plus, Trash2 } from "@/components/icons"
import { StatusBadge } from "@/components/status-badge"
import { formatRelativeTime } from "@/lib/format"
import type { CredentialHistoryEntry, EmployeeCredential } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

const emptyCredentialForm = { label: "", value: "" }

/** Encrypted vault of logins/passwords issued to the employee, with its change log. */
export function CredentialsPanel({
  employeeId,
  credentials: initialCredentials,
  history,
}: {
  employeeId: string
  credentials: EmployeeCredential[]
  history: CredentialHistoryEntry[]
}) {
  const [credentials, setCredentials] = useState(initialCredentials)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(emptyCredentialForm)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [editing, setEditing] = useState<EmployeeCredential | null>(null)
  const [editForm, setEditForm] = useState(emptyCredentialForm)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleAddCredential() {
    if (!addForm.label.trim() || !addForm.value.trim()) {
      setAddError("Label and value are both required.")
      return
    }
    setAddSubmitting(true)
    setAddError(null)
    try {
      const res = await fetch(`/api/employees/${employeeId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      })
      const body = await res.json()
      if (!res.ok) {
        setAddError(body.error ?? "Could not add this credential.")
        return
      }
      setCredentials((prev) => [...prev, body])
      setAddForm(emptyCredentialForm)
      setAddOpen(false)
    } finally {
      setAddSubmitting(false)
    }
  }

  function openEdit(c: EmployeeCredential) {
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
      const res = await fetch(`/api/employees/${employeeId}/credentials/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      const body = await res.json()
      if (!res.ok) {
        setEditError(body.error ?? "Could not save this credential.")
        return
      }
      setCredentials((prev) => prev.map((c) => (c.id === editing.id ? body : c)))
      setEditing(null)
    } finally {
      setEditSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this credential?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/employees/${employeeId}/credentials/${id}`, { method: "DELETE" })
      if (!res.ok) return
      setCredentials((prev) => prev.filter((c) => c.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Logins &amp; passwords</CardTitle>
            <CardDescription>Laptop, email or any other login given to this employee. Stored encrypted.</CardDescription>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" className="cursor-pointer" />}>
              <Plus /> Add
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-lg">Add login</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-1">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cred-label">What is it for?</Label>
                  <Input
                    id="cred-label"
                    className="h-10 text-base"
                    value={addForm.label}
                    onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="e.g. Laptop password, Google account, VPN"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cred-value">Password / value</Label>
                  <Input
                    id="cred-value"
                    className="h-10 font-mono text-base"
                    value={addForm.value}
                    onChange={(e) => setAddForm((f) => ({ ...f, value: e.target.value }))}
                  />
                </div>
                {addError ? <p className="text-sm text-destructive">{addError}</p> : null}
              </div>
              <DialogFooter>
                <Button variant="outline" className="cursor-pointer" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button className="cursor-pointer" onClick={handleAddCredential} disabled={addSubmitting}>
                  {addSubmitting ? "Adding…" : "Add"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {credentials.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.label}</p>
                <p className="truncate font-mono text-sm text-muted-foreground">
                  {revealed[c.id] ? c.value : "•".repeat(Math.min(c.value.length, 14))}
                </p>
                <p className="text-xs text-muted-foreground">
                  Updated {formatRelativeTime(c.updatedAt)}
                  {c.updatedBy ? ` by ${c.updatedBy}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  aria-label={revealed[c.id] ? "Hide" : "Show"}
                  onClick={() => setRevealed((r) => ({ ...r, [c.id]: !r[c.id] }))}
                >
                  {revealed[c.id] ? <EyeOff /> : <Eye />}
                </Button>
                <Button variant="ghost" size="icon-sm" className="cursor-pointer" aria-label="Edit" onClick={() => openEdit(c)}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                  aria-label="Delete"
                  disabled={deletingId === c.id}
                  onClick={() => handleDelete(c.id)}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {credentials.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <KeyRound className="size-6" />
              No logins stored yet.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Login change log</CardTitle>
          <CardDescription>Every add, edit and delete in this vault.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Login</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>By</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.label}</TableCell>
                  <TableCell>
                    <StatusBadge status={h.action} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{h.changedBy ?? "—"}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{formatRelativeTime(h.changedAt)}</TableCell>
                </TableRow>
              ))}
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    No changes yet.
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
            <DialogTitle className="text-lg">Edit login</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-cred-label">What is it for?</Label>
              <Input
                id="edit-cred-label"
                className="h-10 text-base"
                value={editForm.label}
                onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-cred-value">Password / value</Label>
              <Input
                id="edit-cred-value"
                className="h-10 font-mono text-base"
                value={editForm.value}
                onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
              />
            </div>
            {editError ? <p className="text-sm text-destructive">{editError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button className="cursor-pointer" onClick={handleSaveEdit} disabled={editSubmitting}>
              {editSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

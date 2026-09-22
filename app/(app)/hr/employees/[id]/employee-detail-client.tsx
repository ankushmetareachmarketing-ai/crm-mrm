"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Eye, EyeOff, KeyRound, Pencil, Plus, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { formatDate, formatRelativeTime } from "@/lib/format"
import type { CredentialHistoryEntry, Employee, EmployeeCredential } from "@/lib/types"
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

export function EmployeeDetailClient({
  employee,
  credentials: initialCredentials,
  history,
}: {
  employee: Employee
  credentials: EmployeeCredential[]
  history: CredentialHistoryEntry[]
}) {
  const [profile, setProfile] = useState({
    salary: employee.salary?.toString() ?? "",
    department: employee.department ?? "",
    address: employee.address ?? "",
    dateOfBirth: employee.dateOfBirth ?? "",
    emergencyContactName: employee.emergencyContactName ?? "",
    emergencyContactPhone: employee.emergencyContactPhone ?? "",
  })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)

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

  async function handleSaveProfile() {
    setProfileSaving(true)
    setProfileMessage(null)
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salary: profile.salary === "" ? null : Number(profile.salary),
          department: profile.department,
          address: profile.address,
          dateOfBirth: profile.dateOfBirth || null,
          emergencyContactName: profile.emergencyContactName,
          emergencyContactPhone: profile.emergencyContactPhone,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        setProfileMessage(body.error ?? "Could not save changes.")
        return
      }
      setProfileMessage("Saved.")
    } finally {
      setProfileSaving(false)
    }
  }

  async function handleAddCredential() {
    if (!addForm.label.trim() || !addForm.value.trim()) {
      setAddError("Label and value are both required.")
      return
    }
    setAddSubmitting(true)
    setAddError(null)
    try {
      const res = await fetch(`/api/employees/${employee.id}/credentials`, {
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
      const res = await fetch(`/api/employees/${employee.id}/credentials/${editing.id}`, {
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
    setDeletingId(id)
    try {
      const res = await fetch(`/api/employees/${employee.id}/credentials/${id}`, { method: "DELETE" })
      if (!res.ok) return
      setCredentials((prev) => prev.filter((c) => c.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="w-fit" nativeButton={false} render={<Link href="/hr/employees" />}>
          <ArrowLeft /> Back to employees
        </Button>
        <PageHeader
          title={employee.name}
          description={`${employee.profile} · ${employee.loginId} · joined ${formatDate(employee.joiningDate)}`}
          actions={<StatusBadge status={employee.active ? "Active" : "Inactive"} />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile & salary</CardTitle>
            <CardDescription>Visible only to Owner and HR.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="salary">Monthly salary (₹)</Label>
                <Input
                  id="salary"
                  type="number"
                  className="h-10 text-base"
                  value={profile.salary}
                  onChange={(e) => setProfile((p) => ({ ...p, salary: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  className="h-10 text-base"
                  value={profile.department}
                  onChange={(e) => setProfile((p) => ({ ...p, department: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                className="h-10 text-base"
                value={profile.address}
                onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  className="h-10 text-base"
                  value={profile.dateOfBirth}
                  onChange={(e) => setProfile((p) => ({ ...p, dateOfBirth: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact">Contact</Label>
                <Input id="contact" className="h-10 text-base" value={employee.contact} disabled />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emg-name">Emergency contact name</Label>
                <Input
                  id="emg-name"
                  className="h-10 text-base"
                  value={profile.emergencyContactName}
                  onChange={(e) => setProfile((p) => ({ ...p, emergencyContactName: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emg-phone">Emergency contact phone</Label>
                <Input
                  id="emg-phone"
                  className="h-10 text-base"
                  value={profile.emergencyContactPhone}
                  onChange={(e) => setProfile((p) => ({ ...p, emergencyContactPhone: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleSaveProfile} disabled={profileSaving} className="w-fit">
                {profileSaving ? "Saving…" : "Save changes"}
              </Button>
              {profileMessage ? <span className="text-sm text-muted-foreground">{profileMessage}</span> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Credentials vault</CardTitle>
              <CardDescription>
                Laptop, Google account or any other password this employee was issued. Values are encrypted at rest.
              </CardDescription>
            </div>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger render={<Button size="sm" variant="outline" />}>
                <Plus /> Add
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-lg">Add credential</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-1">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cred-label">Label</Label>
                    <Input
                      id="cred-label"
                      className="h-10 text-base"
                      value={addForm.label}
                      onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))}
                      placeholder="e.g. Laptop password, Google account, VPN"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cred-value">Value</Label>
                    <Input
                      id="cred-value"
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
                  <Button onClick={handleAddCredential} disabled={addSubmitting}>
                    {addSubmitting ? "Adding…" : "Add credential"}
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
                No credentials stored yet.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credential history</CardTitle>
          <CardDescription>Every create, update and delete on this employee&apos;s vault.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Changed by</TableHead>
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
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatRelativeTime(h.changedAt)}
                  </TableCell>
                </TableRow>
              ))}
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    No credential changes recorded yet.
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
            <DialogTitle className="text-lg">Edit credential</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-cred-label">Label</Label>
              <Input
                id="edit-cred-label"
                className="h-10 text-base"
                value={editForm.label}
                onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-cred-value">Value</Label>
              <Input
                id="edit-cred-value"
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

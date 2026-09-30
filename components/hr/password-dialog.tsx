"use client"

import { useState } from "react"
import { KeyRound } from "@/components/icons"
import { Field } from "@/components/hr/form-bits"
import { Button } from "@/components/ui/button"
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

/**
 * "self": the signed-in employee changes their own password (needs the current one).
 * "reset": Owner / HR sets a new password for someone else.
 */
export function PasswordDialog({ employeeId, mode, name }: { employeeId: string; mode: "self" | "reset"; name?: string }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" })
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  function reset(next: boolean) {
    setOpen(next)
    if (!next) {
      setForm({ currentPassword: "", newPassword: "", confirm: "" })
      setError(null)
      setDone(false)
    }
  }

  async function save() {
    if (form.newPassword.length < 6) {
      setError("New password must be at least 6 characters.")
      return
    }
    if (form.newPassword !== form.confirm) {
      setError("The two new passwords don't match.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/employees/${employeeId}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Could not change the password.")
        return
      }
      setDone(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger render={<Button variant="outline" className="cursor-pointer" />}>
        <KeyRound /> {mode === "self" ? "Change password" : "Reset password"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{mode === "self" ? "Change your password" : `Reset password${name ? ` for ${name}` : ""}`}</DialogTitle>
          <DialogDescription>
            {mode === "self"
              ? "Use at least 6 characters. You'll use the new one next time you log in."
              : "They'll get a notification. Share the new password with them privately."}
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Password changed.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {mode === "self" ? (
              <Field label="Current password" htmlFor="pw-current">
                <Input id="pw-current" type="password" autoComplete="current-password" className="h-10 text-base" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
              </Field>
            ) : null}
            <Field label="New password" htmlFor="pw-new">
              <Input id="pw-new" type="password" autoComplete="new-password" className="h-10 text-base" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
            </Field>
            <Field label="Type the new password again" htmlFor="pw-confirm">
              <Input id="pw-confirm" type="password" autoComplete="new-password" className="h-10 text-base" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
            </Field>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={() => reset(false)}>
            {done ? "Close" : "Cancel"}
          </Button>
          {!done ? (
            <Button
              className="cursor-pointer"
              disabled={saving || !form.newPassword || (mode === "self" && !form.currentPassword)}
              onClick={save}
            >
              {saving ? "Saving…" : "Save password"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

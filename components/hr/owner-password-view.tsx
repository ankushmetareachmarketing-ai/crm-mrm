"use client"

import { useState } from "react"
import { Eye, EyeOff } from "@/components/icons"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface StoredPassword {
  value: string | null
  setAt: string
  setBy: string | null
  current: boolean
}

/** Owner only: see an employee's current and earlier login passwords. */
export function OwnerPasswordView({ employeeId, name }: { employeeId: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [passwords, setPasswords] = useState<StoredPassword[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState<Record<number, boolean>>({ 0: true })
  const [copied, setCopied] = useState<number | null>(null)

  async function load() {
    setOpen(true)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/employees/${employeeId}/password`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Could not load passwords.")
        return
      }
      setPasswords(data.passwords)
    } finally {
      setLoading(false)
    }
  }

  async function copy(i: number, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(i)
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      // Clipboard blocked — the password is visible to copy by hand.
    }
  }

  return (
    <>
      <Button variant="outline" className="cursor-pointer" onClick={load}>
        <Eye /> Show passwords
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) {
            setPasswords(null)
            setShown({ 0: true })
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Passwords — {name}</DialogTitle>
            <DialogDescription>Only you (the Owner) can see this. Opening it is noted in their history.</DialogDescription>
          </DialogHeader>
          {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {passwords && passwords.length === 0 ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              No saved password yet. Passwords set before this feature were never stored in a readable form — use
              <b> Reset password</b> once and it will show here from then on.
            </p>
          ) : null}
          {passwords && passwords.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {passwords.map((p, i) => (
                <li key={`${p.setAt}-${i}`} className={cn("rounded-xl border p-3", p.current && "border-primary/40 bg-primary/5")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                      {p.current ? "Current password" : `Earlier password`}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(p.setAt)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <code className="truncate font-mono text-base font-semibold">
                      {p.value === null ? "Can't be read" : shown[i] ? p.value : "•".repeat(Math.min(p.value.length, 12))}
                    </code>
                    {p.value !== null ? (
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="icon-sm" className="cursor-pointer" aria-label={shown[i] ? "Hide" : "Show"} onClick={() => setShown((s) => ({ ...s, [i]: !s[i] }))}>
                          {shown[i] ? <EyeOff /> : <Eye />}
                        </Button>
                        <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => copy(i, p.value!)}>
                          {copied === i ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  {p.setBy ? <p className="text-xs text-muted-foreground">Set by {p.setBy}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

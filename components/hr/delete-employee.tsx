"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "@/components/icons"
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

/** Owner only: permanently delete an employee after typing their name to confirm. */
export function DeleteEmployee({ employeeId, name }: { employeeId: string; name: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/employees/${employeeId}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Could not delete.")
        return
      }
      setOpen(false)
      router.push("/hr/employees")
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-rose-200">
      <CardHeader>
        <CardTitle className="text-base text-rose-700">Delete employee</CardTitle>
        <CardDescription>
          For someone added by mistake or who never joined. Removes them and their attendance, leave, documents and notes.
          If they already have clients, payments or calls, set their status to <b>Terminated</b> instead.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          className="cursor-pointer border-rose-300 text-rose-700 hover:bg-rose-50"
          onClick={() => {
            setTyped("")
            setError(null)
            setOpen(true)
          }}
        >
          <Trash2 /> Delete {name}
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg text-rose-700">Delete {name}?</DialogTitle>
            <DialogDescription>This can&apos;t be undone. Type their full name to confirm.</DialogDescription>
          </DialogHeader>
          <Input className="h-10 text-base" placeholder={name} value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-rose-600 text-white hover:bg-rose-700"
              disabled={busy || typed.trim() !== name.trim()}
              onClick={remove}
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

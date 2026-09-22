"use client"

import { useState } from "react"
import type { ClientNote } from "@/lib/types"
import { formatRelativeTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

export function NotesPanel({
  clientId,
  initialNotes,
}: {
  clientId: string
  initialNotes: ClientNote[]
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!body.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) return
      const responseBody = await res.json()
      setNotes((prev) => [responseBody.note, ...prev])
      setBody("")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a note about this client…"
            rows={3}
          />
          <Button size="sm" className="w-fit" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : "Add note"}
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border p-3">
              <p className="text-sm">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.author ?? "Unknown"} · {formatRelativeTime(n.createdAt)}
              </p>
            </div>
          ))}
          {notes.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No notes yet.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

"use client"

import { useMemo, useState } from "react"
import { SearchField } from "@/components/search-field"
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
  const [query, setQuery] = useState("")
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const visibleNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return notes
    return notes.filter((note) =>
      [note.body, note.author].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery))
    )
  }, [notes, query])

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
        <SearchField
          className="w-full sm:max-w-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes by text or author…"
        />
        <div className="flex flex-col gap-3">
          {visibleNotes.map((n) => (
            <div key={n.id} className="rounded-lg border p-3">
              <p className="text-sm">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.author ?? "Unknown"} · {formatRelativeTime(n.createdAt)}
              </p>
            </div>
          ))}
          {visibleNotes.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {query ? "No notes match your search." : "No notes yet."}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

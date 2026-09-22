"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface RecordOption {
  entityType: "lead" | "client"
  entityId: string
  label: string
}

export function ActivityComposer({ records }: { records: RecordOption[] }) {
  const [selected, setSelected] = useState("")
  const [detail, setDetail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit() {
    if (!selected || !detail.trim()) return
    const [entityType, entityId] = selected.split(":") as ["lead" | "client", string]
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, detail }),
      })
      const body = await res.json()
      if (!res.ok) {
        setMessage(body.error ?? "Could not log the update.")
        return
      }
      setDetail("")
      setMessage("Logged.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Select value={selected} onValueChange={(v) => setSelected(v ?? "")}>
        <SelectTrigger className="h-10 w-full text-base">
          <SelectValue placeholder="Select a lead or client…">
            {(v: string) => records.find((r) => `${r.entityType}:${r.entityId}` === v)?.label ?? "Select a lead or client…"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {records.map((r) => (
            <SelectItem key={`${r.entityType}:${r.entityId}`} value={`${r.entityType}:${r.entityId}`}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea
        placeholder="What happened? e.g. Called, sent pricing, following up Monday…"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        rows={2}
      />
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={handleSubmit} disabled={submitting || !selected || !detail.trim()} className="w-fit">
          {submitting ? "Logging…" : "Log update"}
        </Button>
        {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
      </div>
    </div>
  )
}

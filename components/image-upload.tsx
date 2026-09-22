"use client"

import { useState, type ChangeEvent } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { UploadKind } from "@/lib/storage"

export function ImageUpload({
  kind,
  label,
  value,
  onChange,
  htmlId,
}: {
  kind: UploadKind
  label: string
  value: string | null
  onChange: (url: string | null) => void
  htmlId: string
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("kind", kind)
      const res = await fetch("/api/uploads", { method: "POST", body: formData })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? "Upload failed.")
        return
      }
      onChange(body.url)
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlId}>{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-12 rounded-md border object-cover" />
        ) : (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">
            No image
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1">
          <Input
            id={htmlId}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFileChange}
            disabled={uploading}
          />
          {uploading ? <p className="text-xs text-muted-foreground">Uploading…</p> : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}

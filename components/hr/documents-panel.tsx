"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Download, Eye, FileText, Trash2, Upload } from "@/components/icons"
import { Field, TextSelect } from "@/components/hr/form-bits"
import { DOCUMENT_CATEGORIES } from "@/lib/hr/constants"
import type { EmployeeDocument } from "@/lib/hr/types"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

function fileSize(bytes: number | null) {
  if (!bytes) return ""
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Upload and open an employee's private documents. HR can delete; everyone else only adds. */
export function DocumentsPanel({
  employeeId,
  documents,
  canDelete,
}: {
  employeeId: string
  documents: EmployeeDocument[]
  canDelete: boolean
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<string>("ID Proof")
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function upload() {
    if (!file) {
      setError("Choose a file first.")
      return
    }
    setUploading(true)
    setError(null)
    try {
      const data = new FormData()
      data.append("file", file)
      data.append("category", category)
      data.append("title", title)
      const res = await fetch(`/api/employees/${employeeId}/documents`, { method: "POST", body: data })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? "Upload failed.")
        return
      }
      setFile(null)
      setTitle("")
      if (fileRef.current) fileRef.current.value = ""
      router.refresh()
    } finally {
      setUploading(false)
    }
  }

  async function remove(doc: EmployeeDocument) {
    if (!window.confirm(`Delete "${doc.title}"? This can't be undone.`)) return
    setDeletingId(doc.id)
    try {
      const res = await fetch(`/api/employees/${employeeId}/documents/${doc.id}`, { method: "DELETE" })
      if (res.ok) router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  const grouped = DOCUMENT_CATEGORIES.map((c) => ({ category: c, docs: documents.filter((d) => d.category === c) })).filter(
    (g) => g.docs.length > 0
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Private files — only this employee, HR and the Owner can open them.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {grouped.map((g) => (
            <div key={g.category} className="flex flex-col gap-2">
              <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{g.category}</p>
              {g.docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[d.fileName, fileSize(d.sizeBytes), formatDate(d.createdAt), d.uploadedBy ? `by ${d.uploadedBy}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="cursor-pointer"
                      aria-label="Open"
                      nativeButton={false}
                      render={<a href={`/api/employees/${employeeId}/documents/${d.id}`} target="_blank" rel="noreferrer" />}
                    >
                      <Eye />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="cursor-pointer"
                      aria-label="Download"
                      nativeButton={false}
                      render={<a href={`/api/employees/${employeeId}/documents/${d.id}?download=1`} />}
                    >
                      <Download />
                    </Button>
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="cursor-pointer"
                        aria-label="Delete"
                        disabled={deletingId === d.id}
                        onClick={() => remove(d)}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {documents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <FileText className="size-7" />
              No documents uploaded yet.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Upload a document</CardTitle>
          <CardDescription>PDF, Word or image, up to 10MB.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Type" htmlFor="doc-cat">
            <TextSelect id="doc-cat" value={category} onChange={(v) => setCategory(v || "Other")} options={DOCUMENT_CATEGORIES} placeholder="Select" />
          </Field>
          <Field label="Name (optional)" htmlFor="doc-title">
            <Input id="doc-title" className="h-10 text-base" placeholder="e.g. Aadhaar card" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="File" htmlFor="doc-file">
            <Input
              id="doc-file"
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,image/png,image/jpeg,image/webp"
              className="h-10 cursor-pointer"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="cursor-pointer" onClick={upload} disabled={uploading || !file}>
            <Upload /> {uploading ? "Uploading…" : "Upload"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

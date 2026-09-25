"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, X } from "@/components/icons"
import { Button } from "@/components/ui/button"

/** Owner's Approve / Reject buttons for a pending service or payment. Refreshes the page's data on success. */
export function ApprovalActions({ kind, id }: { kind: "service" | "payment"; id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<"Approved" | "Rejected" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(decision: "Approved" | "Rejected") {
    if (decision === "Rejected" && !window.confirm(`Reject this ${kind}? It will not be added to the client's account.`)) {
      return
    }
    setBusy(decision)
    setError(null)
    try {
      const url = kind === "service" ? `/api/charges/${id}/approve` : `/api/payments/${encodeURIComponent(id)}/approve`
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? "Could not save the decision.")
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="cursor-pointer"
          disabled={busy !== null}
          onClick={(e) => {
            e.stopPropagation()
            decide("Rejected")
          }}
        >
          <X /> {busy === "Rejected" ? "Rejecting…" : "Reject"}
        </Button>
        <Button
          size="sm"
          className="cursor-pointer"
          disabled={busy !== null}
          onClick={(e) => {
            e.stopPropagation()
            decide("Approved")
          }}
        >
          <Check /> {busy === "Approved" ? "Approving…" : "Approve"}
        </Button>
      </div>
      {error ? <p className="max-w-56 text-right text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Megaphone } from "@/components/icons"
import {
  CAMPAIGN_ACTION_LABEL,
  CAMPAIGN_NEXT,
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_STATUS_STYLE,
  type CampaignStatus,
} from "@/lib/campaigns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function CampaignStatusBadge({ status, className }: { status: CampaignStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        CAMPAIGN_STATUS_STYLE[status],
        className
      )}
    >
      <Megaphone className="size-3.5" />
      {CAMPAIGN_STATUS_LABEL[status]}
    </span>
  )
}

/** The Campaign Manager's next-step buttons for one campaign. Reject asks for a reason. */
export function CampaignActions({ id, status }: { id: string; status: CampaignStatus }) {
  const router = useRouter()
  const [busy, setBusy] = useState<CampaignStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const next = CAMPAIGN_NEXT[status]
  if (next.length === 0) return null

  async function move(to: CampaignStatus) {
    let note = ""
    if (to === "Rejected") {
      const input = window.prompt("Why is this campaign rejected? (the sales person will see this)")
      if (input === null) return
      note = input
    }
    setBusy(to)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to, note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Could not save.")
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        {next.map((to) => (
          <Button
            key={to}
            size="sm"
            variant={to === "Rejected" ? "outline" : "default"}
            className={cn("cursor-pointer", to === "Rejected" && "text-rose-700")}
            disabled={busy !== null}
            onClick={() => move(to)}
          >
            {busy === to ? "Saving…" : CAMPAIGN_ACTION_LABEL[to]}
          </Button>
        ))}
      </div>
      {error ? <p className="max-w-60 text-right text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

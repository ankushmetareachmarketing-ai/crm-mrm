"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckCircle2, Clock, Megaphone, Search, TrendingUp } from "@/components/icons"
import { StatCard } from "@/components/stat-card"
import { CampaignActions, CampaignStatusBadge } from "@/components/campaign-parts"
import { TestingBadge } from "@/components/money-badges"
import { isTestingService, testedServiceOf, unitFor } from "@/lib/billing"
import type { CampaignStatus } from "@/lib/campaigns"
import type { CampaignRow } from "@/lib/data/campaigns"
import { formatDate, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ALL = "all"

/** Where a campaign is — including before the Owner has approved the booking. */
function StageBadge({ c }: { c: CampaignRow }) {
  if (c.ownerStatus === "Pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-amber-400 bg-white px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-amber-800">
        <Clock className="size-3.5" /> Waiting for Owner
      </span>
    )
  }
  if (c.ownerStatus === "Rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-rose-700">
        Rejected by Owner
      </span>
    )
  }
  return c.status ? <CampaignStatusBadge status={c.status} /> : null
}

function CampaignCard({ c, canAct }: { c: CampaignRow; canAct: boolean }) {
  const unit = unitFor(c.service)
  const waitingForMe = c.ownerStatus === "Approved" && c.status === "Pending"
  const ownerWaiting = c.ownerStatus === "Pending"
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-start sm:justify-between",
        waitingForMe && "border-amber-300 ring-1 ring-amber-200",
        ownerWaiting && "border-dashed bg-muted/20"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Megaphone className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold">{testedServiceOf(c.service)}</p>
            {isTestingService(c.service) ? <TestingBadge free={c.total === 0} /> : null}
            <StageBadge c={c} />
          </div>
          <p className="text-sm">
            <Link href={`/sales-details/${c.clientId}`} className="font-medium hover:underline">
              {c.company}
            </Link>
            <span className="text-muted-foreground">
              {" "}
              · {c.quantity.toLocaleString("en-IN")} {unit.plural} · service date {formatDate(c.serviceDate)}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Sales person: {c.salesPerson ?? "—"}
            {c.addedBy && c.addedBy !== c.salesPerson ? ` · added by ${c.addedBy}` : ""}
            {c.ownerApprovedAt ? ` · Owner approved ${formatDateTime(c.ownerApprovedAt)}` : ""}
          </p>
          {c.notes ? <p className="mt-1 text-sm text-muted-foreground">Note: {c.notes}</p> : null}
          {c.decidedBy ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Last update by {c.decidedBy} · {formatDateTime(c.decidedAt)}
              {c.campaignNote ? ` — “${c.campaignNote}”` : ""}
            </p>
          ) : null}
        </div>
      </div>
      {canAct && c.ownerStatus === "Approved" && c.status ? <CampaignActions id={c.id} status={c.status} /> : null}
      {ownerWaiting ? (
        <p className="text-xs text-muted-foreground sm:max-w-48 sm:text-right">You can act once the Owner approves this booking.</p>
      ) : null}
    </div>
  )
}

export function CampaignBoard({ campaigns, canAct }: { campaigns: CampaignRow[]; canAct: boolean }) {
  const [query, setQuery] = useState("")
  const [service, setService] = useState(ALL)

  const q = query.trim().toLowerCase()
  const visible = campaigns.filter(
    (c) =>
      (service === ALL || testedServiceOf(c.service) === service) &&
      (!q || [c.company, c.service, c.salesPerson, c.addedBy, c.notes].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
  )
  const live = (c: CampaignRow) => c.ownerStatus === "Approved" && c.status !== null
  const by = (statuses: CampaignStatus[]) => visible.filter((c) => live(c) && statuses.includes(c.status!))
  const count = (s: CampaignStatus) => campaigns.filter((c) => live(c) && c.status === s).length
  const withOwner = campaigns.filter((c) => c.ownerStatus === "Pending").length

  const sections: { title: string; description: string; items: CampaignRow[]; empty: string }[] = [
    {
      title: "Waiting for Owner",
      description: "Booked by sales, not approved by the Owner yet. They move to you once approved.",
      items: visible.filter((c) => c.ownerStatus === "Pending"),
      empty: "Nothing waiting for the Owner.",
    },
    { title: "Waiting for you", description: "Approved by the Owner — approve or reject.", items: by(["Pending"]), empty: "Nothing waiting." },
    {
      title: "Approved & running",
      description: "Start approved campaigns and mark them done when finished.",
      items: by(["Approved", "Running"]),
      empty: "No active campaigns.",
    },
    {
      title: "Done & rejected",
      description: "Finished campaigns, and ones turned down by you or the Owner.",
      items: [...by(["Completed", "Rejected"]), ...visible.filter((c) => c.ownerStatus === "Rejected")],
      empty: "Nothing here yet.",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Waiting for Campaign Manager"
          value={String(count("Pending"))}
          icon={Clock}
          hint={withOwner > 0 ? `${withOwner} still with the Owner` : "Approved by the Owner"}
        />
        <StatCard label="Approved" value={String(count("Approved"))} icon={CheckCircle2} hint="Not started yet" />
        <StatCard label="Running" value={String(count("Running"))} icon={TrendingUp} />
        <StatCard label="Done" value={String(count("Completed"))} icon={Megaphone} hint={`${count("Rejected")} rejected`} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search client, sales person or note…" className="h-10 pl-9 text-base" />
        </div>
        <Select value={service} onValueChange={(v) => setService(v ?? ALL)}>
          <SelectTrigger className="h-10 w-full cursor-pointer sm:w-52">
            <SelectValue>{(v: string) => (v === ALL ? "All campaigns" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All campaigns</SelectItem>
            <SelectItem value="SMS Campaign">SMS Campaign</SelectItem>
            <SelectItem value="Voice Campaign">Voice Campaign</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sections.map((s) =>
        s.title === "Waiting for Owner" && s.items.length === 0 ? null : (
          <Card key={s.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {s.title}
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{s.items.length}</span>
              </CardTitle>
              <CardDescription>{s.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {s.items.map((c) => (
                <CampaignCard key={c.id} c={c} canAct={canAct} />
              ))}
              {s.items.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{s.empty}</p> : null}
            </CardContent>
          </Card>
        )
      )}
    </div>
  )
}

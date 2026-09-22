"use client"

import { useMemo, useState } from "react"
import { Plus, Search } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency, formatDate } from "@/lib/format"
import { campaigns } from "@/lib/mock-data"
import type { CampaignStatus } from "@/lib/types"
import { useRole } from "@/components/role-context"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const statuses: (CampaignStatus | "All")[] = [
  "All",
  "Draft",
  "Submitted",
  "Approved",
  "Queued",
  "Running",
  "Completed",
  "Partially Completed",
  "Failed",
  "Cancelled",
]

export default function CampaignsPage() {
  const { role } = useRole()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<(CampaignStatus | "All")>("All")

  const canApprove = role === "Owner"

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      const matchesStatus = status === "All" || c.status === status
      const matchesQuery =
        query.trim() === "" ||
        c.client.toLowerCase().includes(query.toLowerCase()) ||
        c.id.toLowerCase().includes(query.toLowerCase())
      return matchesStatus && matchesQuery
    })
  }, [query, status])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Campaign Operations"
        description="Draft → Submitted → Approved → Queued → Running → Completed. Only an approved version enters execution."
        actions={
          <Button size="sm">
            <Plus /> New request
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by client or campaign ID…"
                className="pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as CampaignStatus | "All")}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status">
                  {(v: CampaignStatus | "All") => (v === "All" ? "All statuses" : v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "All" ? "All statuses" : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Vendor / Panel</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Agreed amount</TableHead>
                <TableHead>Costing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                {canApprove ? <TableHead className="text-right">Action</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-mono text-xs">{c.id}</div>
                    <div className="text-xs text-muted-foreground">{c.requestId}</div>
                  </TableCell>
                  <TableCell>{c.client}</TableCell>
                  <TableCell>{c.service}</TableCell>
                  <TableCell>
                    <div className="text-sm">{c.vendor}</div>
                    <div className="text-xs text-muted-foreground">{c.panel}</div>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {c.quantity.toLocaleString("en-IN")} {c.unit}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(c.agreedAmount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.costStatus} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(c.scheduledFor)}
                  </TableCell>
                  {canApprove ? (
                    <TableCell className="text-right">
                      {c.status === "Submitted" ? (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline">Return</Button>
                          <Button size="sm">Approve</Button>
                        </div>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger render={<span className="text-xs text-muted-foreground" />}>
                            —
                          </TooltipTrigger>
                          <TooltipContent>Not awaiting approval</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canApprove ? 10 : 9} className="py-8 text-center text-sm text-muted-foreground">
                    No campaigns match your filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

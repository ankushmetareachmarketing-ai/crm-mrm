"use client"

import { useMemo, useState } from "react"
import { Plus, Search } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { formatDate } from "@/lib/format"
import { tickets as initialTickets } from "@/lib/mock-data"
import type { Ticket, TicketStatus } from "@/lib/types"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const statuses: (TicketStatus | "All")[] = [
  "All",
  "Open",
  "In Progress",
  "Awaiting Client",
  "Resolved",
  "Closed",
]

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<(TicketStatus | "All")>("All")
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ client: "", issueType: "", notes: "" })

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const matchesStatus = status === "All" || t.status === status
      const matchesQuery =
        query.trim() === "" ||
        t.client.toLowerCase().includes(query.toLowerCase()) ||
        t.issueType.toLowerCase().includes(query.toLowerCase())
      return matchesStatus && matchesQuery
    })
  }, [tickets, query, status])

  function handleCreate() {
    if (!form.client.trim() || !form.issueType.trim()) return
    const newTicket: Ticket = {
      id: `TCK-${450 + tickets.length}`,
      client: form.client,
      service: "—",
      issueType: form.issueType,
      priority: "Medium",
      status: "Open",
      assignee: "Unassigned",
      dueDate: "—",
      updatedAt: new Date().toISOString().slice(0, 10),
    }
    setTickets((prev) => [newTicket, ...prev])
    setForm({ client: "", issueType: "", notes: "" })
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Support & DLT Tickets"
        description="Internal and external DLT support assignments are restricted to the assigned employee."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus /> New ticket
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create ticket</DialogTitle>
                <DialogDescription>Raised tickets start in the Open status, unassigned.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="client">Client</Label>
                  <Input
                    id="client"
                    value={form.client}
                    onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
                    placeholder="e.g. Orchid Clinics"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="issueType">Issue / request type</Label>
                  <Input
                    id="issueType"
                    value={form.issueType}
                    onChange={(e) => setForm((f) => ({ ...f, issueType: e.target.value }))}
                    placeholder="e.g. Template rejected"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Additional context for the assignee"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create ticket</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by client or issue type…"
                className="pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as TicketStatus | "All")}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status">
                  {(v: TicketStatus | "All") => (v === "All" ? "All statuses" : v)}
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
                <TableHead>Ticket</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead className="text-right">Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.id}</TableCell>
                  <TableCell>{t.client}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.service}</TableCell>
                  <TableCell>{t.issueType}</TableCell>
                  <TableCell>
                    <StatusBadge status={t.priority} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.assignee}</TableCell>
                  <TableCell className="text-right text-sm">{formatDate(t.dueDate)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No tickets match your filters.
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

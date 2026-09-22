"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Pencil, Plus, Search } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { formatDate, getInitials } from "@/lib/format"
import type { Lead, LeadPriority, LeadStage } from "@/lib/types"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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

const stages: (LeadStage | "All")[] = ["All", "New", "Contacted", "Meeting Scheduled", "Won", "Lost"]
const editableStages: LeadStage[] = ["New", "Contacted", "Meeting Scheduled", "Won", "Lost"]
const priorities: LeadPriority[] = ["Low", "Medium", "High"]

const emptyForm = {
  company: "",
  contact: "",
  industry: "",
  designation: "",
  source: "",
  stage: "New" as LeadStage,
  ownerEmployeeId: "",
  nextAction: "",
  nextActionDue: "",
  website: "",
  companySize: "",
  budget: "",
  priority: "Medium" as LeadPriority,
  expectedCloseDate: "",
}

export function LeadsClient({
  initialLeads,
  employees,
  currentEmployeeId,
  isOwner,
}: {
  initialLeads: Lead[]
  employees: { id: string; name: string }[]
  currentEmployeeId: string
  isOwner: boolean
}) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [query, setQuery] = useState("")
  const [stage, setStage] = useState<(LeadStage | "All")>("All")

  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchesStage = stage === "All" || l.stage === stage
      const matchesQuery =
        query.trim() === "" ||
        l.company.toLowerCase().includes(query.toLowerCase()) ||
        l.contact.toLowerCase().includes(query.toLowerCase())
      return matchesStage && matchesQuery
    })
  }, [leads, query, stage])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setOpen(true)
  }

  function openEdit(lead: Lead) {
    setEditingId(lead.id)
    setForm({
      company: lead.company,
      contact: lead.contact,
      industry: lead.industry,
      designation: lead.designation,
      source: lead.source,
      stage: lead.stage,
      ownerEmployeeId: lead.ownerEmployeeId ?? "",
      nextAction: lead.nextAction === "—" ? "" : lead.nextAction,
      nextActionDue: lead.nextActionDue === "—" ? "" : lead.nextActionDue,
      website: lead.website ?? "",
      companySize: lead.companySize ?? "",
      budget: lead.budget ? String(lead.budget) : "",
      priority: lead.priority,
      expectedCloseDate: lead.expectedCloseDate ?? "",
    })
    setError(null)
    setOpen(true)
  }

  async function handleSubmit() {
    if (!form.company.trim() || !form.contact.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      if (editingId) {
        const res = await fetch(`/api/leads/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        const body = await res.json()
        if (!res.ok) {
          setError(body.error ?? "Could not update the lead.")
          return
        }
        const ownerName = employees.find((e) => e.id === form.ownerEmployeeId)?.name ?? "—"
        setLeads((prev) =>
          prev.map((l) =>
            l.id === editingId
              ? {
                  ...l,
                  company: form.company,
                  contact: form.contact,
                  industry: form.industry || "Unclassified",
                  designation: form.designation || "—",
                  source: form.source || l.source,
                  stage: form.stage,
                  owner: ownerName,
                  ownerEmployeeId: form.ownerEmployeeId || null,
                  nextAction: form.nextAction || "—",
                  nextActionDue: form.nextActionDue || "—",
                  website: form.website || null,
                  companySize: form.companySize || null,
                  budget: form.budget ? Number(form.budget) : null,
                  priority: form.priority,
                  expectedCloseDate: form.expectedCloseDate || null,
                }
              : l
          )
        )
      } else {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        const body = await res.json()
        if (!res.ok) {
          setError(body.error ?? "Could not create the lead.")
          return
        }
        const ownerName = employees.find((e) => e.id === form.ownerEmployeeId)?.name ?? "—"
        const newLead: Lead = {
          id: body.id,
          company: form.company,
          contact: form.contact,
          designation: form.designation || "—",
          source: form.source || "Manual entry",
          industry: form.industry || "Unclassified",
          stage: "New",
          owner: ownerName,
          ownerEmployeeId: form.ownerEmployeeId || null,
          nextAction: form.nextAction || "—",
          nextActionDue: form.nextActionDue || "—",
          createdAt: new Date().toISOString().slice(0, 10),
          website: form.website || null,
          companySize: form.companySize || null,
          budget: form.budget ? Number(form.budget) : null,
          priority: form.priority,
          expectedCloseDate: form.expectedCloseDate || null,
        }
        setLeads((prev) => [newLead, ...prev])
      }
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Leads"
        description="Duplicate company checks suggest possible matches; leads are never silently merged."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" onClick={openCreate} />}>
              <Plus /> New lead
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg">{editingId ? "Edit lead" : "Create lead"}</DialogTitle>
                <DialogDescription>
                  {editingId
                    ? "Update this lead's details, stage, or owner."
                    : "Assign a salesperson and schedule the first meeting after creation."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-5 py-1">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="company">Company name</Label>
                    <Input
                      id="company"
                      className="h-10 text-base"
                      value={form.company}
                      onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                      placeholder="e.g. Anand Retail Group"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="contact">Primary contact</Label>
                    <Input
                      id="contact"
                      className="h-10 text-base"
                      value={form.contact}
                      onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                      placeholder="e.g. Vikram Anand"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="designation">Designation</Label>
                    <Input
                      id="designation"
                      className="h-10 text-base"
                      value={form.designation}
                      onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                      placeholder="e.g. Marketing Head"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      className="h-10 text-base"
                      value={form.industry}
                      onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                      placeholder="e.g. Retail"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lead-website">Company website</Label>
                  <Input
                    id="lead-website"
                    className="h-10 text-base"
                    value={form.website}
                    onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                    placeholder="e.g. https://anandretail.example"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="lead-company-size">Company size</Label>
                    <Input
                      id="lead-company-size"
                      className="h-10 text-base"
                      value={form.companySize}
                      onChange={(e) => setForm((f) => ({ ...f, companySize: e.target.value }))}
                      placeholder="e.g. 51-200"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="lead-budget">Estimated budget (₹)</Label>
                    <Input
                      id="lead-budget"
                      type="number"
                      className="h-10 text-base"
                      value={form.budget}
                      onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                      placeholder="e.g. 50000"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="lead-priority">Priority</Label>
                    <Select
                      value={form.priority}
                      onValueChange={(v) => setForm((f) => ({ ...f, priority: v as LeadPriority }))}
                    >
                      <SelectTrigger id="lead-priority" className="h-10 w-full text-base">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="lead-expected-close">Expected close date</Label>
                    <Input
                      id="lead-expected-close"
                      type="date"
                      className="h-10 text-base"
                      value={form.expectedCloseDate}
                      onChange={(e) => setForm((f) => ({ ...f, expectedCloseDate: e.target.value }))}
                    />
                  </div>
                </div>
                {isOwner || editingId ? (
                  <div className={cn("grid grid-cols-1 gap-4", isOwner && editingId && "sm:grid-cols-2")}>
                    {isOwner ? (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="lead-owner">Owner</Label>
                        <Select
                          value={form.ownerEmployeeId}
                          onValueChange={(v) => setForm((f) => ({ ...f, ownerEmployeeId: v ?? "" }))}
                        >
                          <SelectTrigger id="lead-owner" className="h-10 w-full text-base">
                            <SelectValue placeholder="Select owner">
                              {(v: string) => employees.find((e) => e.id === v)?.name ?? "Select owner"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    {editingId ? (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="lead-stage">Stage</Label>
                        <Select
                          value={form.stage}
                          onValueChange={(v) => setForm((f) => ({ ...f, stage: v as LeadStage }))}
                        >
                          <SelectTrigger id="lead-stage" className="h-10 w-full text-base">
                            <SelectValue placeholder="Stage" />
                          </SelectTrigger>
                          <SelectContent>
                            {editableStages.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="nextAction">Next action</Label>
                    <Input
                      id="nextAction"
                      className="h-10 text-base"
                      value={form.nextAction}
                      onChange={(e) => setForm((f) => ({ ...f, nextAction: e.target.value }))}
                      placeholder="e.g. Discovery call"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="nextActionDue">Next action due</Label>
                    <Input
                      id="nextActionDue"
                      type="date"
                      className="h-10 text-base"
                      value={form.nextActionDue}
                      onChange={(e) => setForm((f) => ({ ...f, nextActionDue: e.target.value }))}
                    />
                  </div>
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Saving…" : editingId ? "Save changes" : "Create lead"}
                </Button>
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
                placeholder="Search by company or contact…"
                className="pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select value={stage} onValueChange={(v) => setStage(v as LeadStage | "All")}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Stage">
                  {(v: LeadStage | "All") => (v === "All" ? "All stages" : v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "All" ? "All stages" : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Next action</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div className="font-medium">{lead.company}</div>
                    <div className="text-xs text-muted-foreground">{lead.id}</div>
                  </TableCell>
                  <TableCell>
                    <div>{lead.contact}</div>
                    <div className="text-xs text-muted-foreground">{lead.designation}</div>
                  </TableCell>
                  <TableCell>{lead.industry}</TableCell>
                  <TableCell>
                    <StatusBadge status={lead.stage} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lead.priority}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarFallback className="text-[10px]">{getInitials(lead.owner)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{lead.owner}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {lead.nextAction}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatDate(lead.nextActionDue)}
                  </TableCell>
                  <TableCell>
                    {isOwner || lead.ownerEmployeeId === currentEmployeeId ? (
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(lead)}>
                        <Pencil />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    No leads match your filters.
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

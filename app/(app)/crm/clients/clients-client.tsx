"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ChevronRight, Pencil, Plus } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { ImageUpload } from "@/components/image-upload"
import { formatCurrency, formatDate } from "@/lib/format"
import type { Client, ClientStatus } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const statuses: ClientStatus[] = ["Active", "On Hold", "Inactive"]

const emptyForm = {
  company: "",
  industry: "",
  ownerEmployeeId: "",
  status: "Active" as ClientStatus,
  website: "",
  logoUrl: null as string | null,
  gstin: "",
  companySize: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  description: "",
}

export function ClientsClient({
  initialClients,
  employees,
  currentEmployeeId,
  isOwner,
}: {
  initialClients: Client[]
  employees: { id: string; name: string }[]
  currentEmployeeId: string
  isOwner: boolean
}) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setOpen(true)
  }

  function openEdit(client: Client) {
    setEditingId(client.id)
    setForm({
      company: client.company,
      industry: client.industry,
      ownerEmployeeId: client.ownerEmployeeId ?? "",
      status: client.status,
      website: client.website ?? "",
      logoUrl: client.logoUrl,
      gstin: client.gstin ?? "",
      companySize: client.companySize ?? "",
      addressLine1: client.addressLine1 ?? "",
      addressLine2: client.addressLine2 ?? "",
      city: client.city ?? "",
      state: client.state ?? "",
      pincode: client.pincode ?? "",
      country: client.country || "India",
      description: client.description ?? "",
    })
    setError(null)
    setOpen(true)
  }

  async function handleSubmit() {
    if (!form.company.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const ownerName = employees.find((e) => e.id === form.ownerEmployeeId)?.name ?? "—"
      if (editingId) {
        const res = await fetch(`/api/clients/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        const body = await res.json()
        if (!res.ok) {
          setError(body.error ?? "Could not update the client.")
          return
        }
        setClients((prev) =>
          prev.map((c) =>
            c.id === editingId
              ? {
                  ...c,
                  company: form.company,
                  industry: form.industry || "Unclassified",
                  owner: ownerName,
                  ownerEmployeeId: form.ownerEmployeeId || null,
                  status: form.status,
                  website: form.website || null,
                  logoUrl: form.logoUrl,
                  gstin: form.gstin || null,
                  companySize: form.companySize || null,
                  addressLine1: form.addressLine1 || null,
                  addressLine2: form.addressLine2 || null,
                  city: form.city || null,
                  state: form.state || null,
                  pincode: form.pincode || null,
                  country: form.country || "India",
                  description: form.description || null,
                }
              : c
          )
        )
      } else {
        const res = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        const body = await res.json()
        if (!res.ok) {
          setError(body.error ?? "Could not create the client.")
          return
        }
        const newClient: Client = {
          id: body.id,
          company: form.company,
          industry: form.industry || "Unclassified",
          owner: ownerName,
          ownerEmployeeId: form.ownerEmployeeId || null,
          status: form.status,
          contacts: 0,
          balance: 0,
          lastReceiptDate: null,
          since: new Date().toISOString().slice(0, 10),
          website: form.website || null,
          logoUrl: form.logoUrl,
          gstin: form.gstin || null,
          companySize: form.companySize || null,
          addressLine1: form.addressLine1 || null,
          addressLine2: form.addressLine2 || null,
          city: form.city || null,
          state: form.state || null,
          pincode: form.pincode || null,
          country: form.country || "India",
          description: form.description || null,
        }
        setClients((prev) => [newClient, ...prev])
      }
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        description="Connected client records. Ownership and reassignment are owner-controlled."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" onClick={openCreate} />}>
              <Plus /> New client
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg">{editingId ? "Edit client" : "Add client"}</DialogTitle>
                <DialogDescription>
                  {editingId
                    ? "Update this client's master details."
                    : "Balance and receipts are tracked separately in Client Finance."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-5 py-1">
                <ImageUpload
                  htmlId="client-logo"
                  kind="client-logos"
                  label="Company logo"
                  value={form.logoUrl}
                  onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
                />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="client-company">Company name</Label>
                  <Input
                    id="client-company"
                    className="h-10 text-base"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    placeholder="e.g. Anand Retail Group"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="client-industry">Industry</Label>
                    <Input
                      id="client-industry"
                      className="h-10 text-base"
                      value={form.industry}
                      onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                      placeholder="e.g. Retail"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="client-size">Company size</Label>
                    <Input
                      id="client-size"
                      className="h-10 text-base"
                      value={form.companySize}
                      onChange={(e) => setForm((f) => ({ ...f, companySize: e.target.value }))}
                      placeholder="e.g. 51-200"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="client-website">Website</Label>
                    <Input
                      id="client-website"
                      className="h-10 text-base"
                      value={form.website}
                      onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                      placeholder="e.g. https://example.com"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="client-gstin">GSTIN</Label>
                    <Input
                      id="client-gstin"
                      className="h-10 text-base"
                      value={form.gstin}
                      onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
                      placeholder="e.g. 27AAECX1234F1Z5"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="client-address1">Address line 1</Label>
                    <Input
                      id="client-address1"
                      className="h-10 text-base"
                      value={form.addressLine1}
                      onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="client-address2">Address line 2</Label>
                    <Input
                      id="client-address2"
                      className="h-10 text-base"
                      value={form.addressLine2}
                      onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="client-city">City</Label>
                    <Input
                      id="client-city"
                      className="h-10 text-base"
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="client-state">State</Label>
                    <Input
                      id="client-state"
                      className="h-10 text-base"
                      value={form.state}
                      onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="client-pincode">Pincode</Label>
                    <Input
                      id="client-pincode"
                      className="h-10 text-base"
                      value={form.pincode}
                      onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="client-country">Country</Label>
                    <Input
                      id="client-country"
                      className="h-10 text-base"
                      value={form.country}
                      onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    />
                  </div>
                </div>
                <div className={cn("grid grid-cols-1 gap-4", isOwner && "sm:grid-cols-2")}>
                  {isOwner ? (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="client-owner">Owner</Label>
                      <Select
                        value={form.ownerEmployeeId}
                        onValueChange={(v) => setForm((f) => ({ ...f, ownerEmployeeId: v ?? "" }))}
                      >
                        <SelectTrigger id="client-owner" className="h-10 w-full text-base">
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
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="client-status">Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm((f) => ({ ...f, status: v as ClientStatus }))}
                    >
                      <SelectTrigger id="client-status" className="h-10 w-full text-base">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="client-description">Description / notes</Label>
                  <Textarea
                    id="client-description"
                    className="text-base"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Saving…" : editingId ? "Save changes" : "Add client"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Last receipt</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7 rounded-md">
                        {client.logoUrl ? <AvatarImage src={client.logoUrl} alt="" /> : null}
                        <AvatarFallback className="rounded-md text-[10px]">
                          {client.company.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <Link href={`/crm/clients/${client.id}`} className="font-medium hover:underline">
                          {client.company}
                        </Link>
                        <div className="text-xs text-muted-foreground">{client.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{client.industry}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{client.owner}</TableCell>
                  <TableCell>
                    <StatusBadge status={client.status} />
                  </TableCell>
                  <TableCell>{client.contacts}</TableCell>
                  <TableCell className="text-right">
                    <span className={client.balance > 0 ? "text-foreground" : "text-emerald-700"}>
                      {formatCurrency(Math.abs(client.balance))}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      {client.balance > 0 ? "due" : client.balance < 0 ? "advance" : ""}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(client.lastReceiptDate)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {isOwner || client.ownerEmployeeId === currentEmployeeId ? (
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(client)}>
                          <Pencil />
                        </Button>
                      ) : null}
                      <Link href={`/crm/clients/${client.id}`}>
                        <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No clients yet.
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

"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import * as XLSX from "@e965/xlsx"
import { cn } from "@/lib/utils"
import { ChevronRight, Download, Pencil, Plus, Trash2, Upload } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { SearchField } from "@/components/search-field"
import { StatusBadge } from "@/components/status-badge"
import { ImageUpload } from "@/components/image-upload"
import { downloadCsv } from "@/lib/export-csv"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const statuses: ClientStatus[] = ["Active", "On Hold", "Inactive"]
const MAX_IMPORT_ROWS = 500

interface BulkClientRow {
  company: string
  phone: string
  industry: string
  owner: string
  status: string
  website: string
  gstin: string
  companySize: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  pincode: string
  country: string
  description: string
  renewalDate: string
}

interface BulkImportIssue {
  row: number
  messages: string[]
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function validateBulkRows(rows: BulkClientRow[]): BulkImportIssue[] {
  return rows.flatMap((row, index) => {
    const issues: string[] = []
    const digits = row.phone.replace(/\D/g, "")
    if (!row.company) issues.push("Company Name is required")
    if (!row.phone || !/^\+?[\d\s().-]+$/.test(row.phone) || digits.length < 7 || digits.length > 15) {
      issues.push("Number must contain 7–15 digits")
    }
    if (!statuses.some((status) => status.toLowerCase() === row.status.toLowerCase())) {
      issues.push("Status must be Active, On Hold, or Inactive")
    }
    return issues.length ? [{ row: index + 2, messages: issues }] : []
  })
}

const emptyForm = {
  company: "",
  phone: "",
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
  renewalDate: "",
}

const BULK_COLUMNS: { key: keyof BulkClientRow; header: string; aliases: string[] }[] = [
  { key: "company", header: "Company Name", aliases: ["companyname", "company"] },
  { key: "phone", header: "Number", aliases: ["number", "phone", "phonenumber", "mobile", "mobilenumber"] },
  { key: "industry", header: "Industry", aliases: ["industry"] },
  { key: "owner", header: "Owner", aliases: ["owner", "ownername", "owneremployeeid"] },
  { key: "status", header: "Status", aliases: ["status"] },
  { key: "website", header: "Website", aliases: ["website"] },
  { key: "gstin", header: "GSTIN", aliases: ["gstin"] },
  { key: "companySize", header: "Company Size", aliases: ["companysize"] },
  { key: "addressLine1", header: "Address Line 1", aliases: ["addressline1", "address1"] },
  { key: "addressLine2", header: "Address Line 2", aliases: ["addressline2", "address2"] },
  { key: "city", header: "City", aliases: ["city"] },
  { key: "state", header: "State", aliases: ["state"] },
  { key: "pincode", header: "Pincode", aliases: ["pincode", "postalcode", "zipcode"] },
  { key: "country", header: "Country", aliases: ["country"] },
  { key: "description", header: "Description", aliases: ["description", "notes"] },
  { key: "renewalDate", header: "Renewal Date", aliases: ["renewaldate", "expirydate"] },
]

type ClientWithFinance = Client & { totalReceived: number }

function renewalTone(renewalDate: string | null): "overdue" | "soon" | null {
  if (!renewalDate) return null
  const daysLeft = Math.ceil((new Date(renewalDate).getTime() - Date.now()) / 86_400_000)
  if (daysLeft < 0) return "overdue"
  if (daysLeft <= 30) return "soon"
  return null
}

export function ClientsClient({
  initialClients,
  employees,
  currentEmployeeId,
  isOwner,
}: {
  initialClients: ClientWithFinance[]
  employees: { id: string; name: string }[]
  currentEmployeeId: string
  isOwner: boolean
}) {
  const [clients, setClients] = useState<ClientWithFinance[]>(initialClients)
  const [clientQuery, setClientQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkFileName, setBulkFileName] = useState("")
  const [bulkRows, setBulkRows] = useState<BulkClientRow[]>([])
  const [bulkIssues, setBulkIssues] = useState<BulkImportIssue[]>([])
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ClientWithFinance | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const visibleClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase()
    if (!query) return clients
    return clients.filter((client) =>
      [client.company, client.phone, client.id, client.industry, client.owner, client.status, client.city, client.state, client.gstin]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    )
  }, [clients, clientQuery])

  async function handleBulkFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBulkFileName(file.name)
    setBulkRows([])
    setBulkIssues([])
    setBulkError(null)
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        setBulkError("The selected file does not contain a worksheet.")
        return
      }
      const sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], {
        defval: "",
        raw: false,
      })
      if (sheetRows.length === 0) {
        setBulkError("The selected file has no client rows.")
        return
      }
      const headers = Object.keys(sheetRows[0]).map((header) => [header, normalizeHeader(header)] as const)
      const matchedHeaders = new Map<keyof BulkClientRow, string>()
      for (const column of BULK_COLUMNS) {
        const header = headers.find(([, key]) => column.aliases.includes(key))?.[0]
        if (header) matchedHeaders.set(column.key, header)
      }
      const missingHeaders = [
        !matchedHeaders.has("company") ? "Company Name" : null,
        !matchedHeaders.has("phone") ? "Number" : null,
        !matchedHeaders.has("status") ? "Status" : null,
      ].filter(Boolean)
      if (missingHeaders.length > 0) {
        setBulkError(`Missing required column${missingHeaders.length > 1 ? "s" : ""}: ${missingHeaders.join(", ")}.`)
        return
      }
      if (sheetRows.length > MAX_IMPORT_ROWS) {
        setBulkError(`Import is limited to ${MAX_IMPORT_ROWS} clients per file.`)
        return
      }
      const parsedRows = sheetRows.map((row) => {
        const parsed = {} as BulkClientRow
        for (const column of BULK_COLUMNS) {
          parsed[column.key] = String(row[matchedHeaders.get(column.key) ?? ""] ?? "").trim()
        }
        return parsed
      })
      setBulkRows(parsedRows)
      setBulkIssues(validateBulkRows(parsedRows))
    } catch {
      setBulkError("Could not read this file. Use a valid CSV or Excel workbook.")
    } finally {
      event.target.value = ""
    }
  }

  function downloadSample() {
    downloadCsv("clients-bulk-upload-sample.csv", [
      {
        "Company Name": "Example Company",
        Number: "9876543210",
        Industry: "Retail",
        Owner: "",
        Status: "Active",
        Website: "https://example.com",
        GSTIN: "",
        "Company Size": "",
        "Address Line 1": "",
        "Address Line 2": "",
        City: "",
        State: "",
        Pincode: "",
        Country: "India",
        Description: "",
        "Renewal Date": "",
      },
    ])
  }

  async function handleBulkImport() {
    if (bulkRows.length === 0 || bulkIssues.length > 0) return
    setBulkSubmitting(true)
    setBulkError(null)
    try {
      const res = await fetch("/api/clients/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clients: bulkRows }),
      })
      const body = await res.json()
      if (!res.ok) {
        setBulkError(body.error ?? "Could not import clients.")
        setBulkIssues(Array.isArray(body.errors) ? body.errors : [])
        return
      }
      const importedClients: ClientWithFinance[] = body.clients.map((client: BulkClientRow & {
        id: string
        ownerEmployeeId: string
        ownerName: string
      }) => ({
        id: client.id,
        company: client.company,
        phone: client.phone,
        industry: client.industry,
        owner: client.ownerName,
        ownerEmployeeId: client.ownerEmployeeId,
        status: client.status as ClientStatus,
        contacts: 0,
        balance: 0,
        lastReceiptDate: null,
        since: new Date().toISOString().slice(0, 10),
        renewalDate: client.renewalDate,
        totalReceived: 0,
        website: client.website,
        logoUrl: null,
        gstin: client.gstin,
        companySize: client.companySize,
        addressLine1: client.addressLine1,
        addressLine2: client.addressLine2,
        city: client.city,
        state: client.state,
        pincode: client.pincode,
        country: client.country,
        description: client.description,
      }))
      setClients((previous) => [...importedClients, ...previous])
      setBulkOpen(false)
      setBulkFileName("")
      setBulkRows([])
      setBulkIssues([])
    } catch {
      setBulkError("Could not reach the server. Please try again.")
    } finally {
      setBulkSubmitting(false)
    }
  }

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
      phone: client.phone ?? "",
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
      renewalDate: client.renewalDate ?? "",
    })
    setError(null)
    setOpen(true)
  }

  async function handleSubmit() {
    if (!form.company.trim()) return
    if (!editingId && !form.phone.trim()) {
      setError("Phone number is required for a new client.")
      return
    }
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
                  phone: form.phone.trim() || null,
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
                  renewalDate: form.renewalDate || null,
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
        const newClient: ClientWithFinance = {
          id: body.id,
          company: form.company,
          phone: form.phone.trim(),
          industry: form.industry || "Unclassified",
          owner: ownerName,
          ownerEmployeeId: form.ownerEmployeeId || null,
          status: form.status,
          contacts: 0,
          balance: 0,
          lastReceiptDate: null,
          since: new Date().toISOString().slice(0, 10),
          renewalDate: form.renewalDate || null,
          totalReceived: 0,
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

  async function handleDeleteClient() {
    if (!deleteTarget) return
    setDeleteSubmitting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/clients/${deleteTarget.id}`, { method: "DELETE" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDeleteError(body.error ?? "Could not delete this client.")
        return
      }
      setClients((previous) => previous.filter((client) => client.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      setDeleteError("Could not reach the server. Please try again.")
    } finally {
      setDeleteSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        description="Connected client records. Ownership and reassignment are owner-controlled."
        actions={
          <div className="flex flex-wrap items-center gap-2">
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" /> }>
              <Upload /> Bulk upload
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg">Bulk upload clients</DialogTitle>
                <DialogDescription>
                  Required: Company Name, Number, Status. Other columns are optional. Company Logo is not included.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-1">
                <Button type="button" variant="outline" className="w-fit" onClick={downloadSample}>
                  <Download /> Download sample CSV
                </Button>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  Include Industry, Owner, Website, GSTIN, Company Size, address fields, Description, or Renewal Date when available. Status: Active, On Hold, or Inactive. Phone numbers need 7–15 digits; use YYYY-MM-DD for Renewal Date.
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="client-bulk-file">CSV or Excel file</Label>
                  <Input
                    id="client-bulk-file"
                    type="file"
                    accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleBulkFileChange}
                  />
                  {bulkFileName ? <p className="text-xs text-muted-foreground">{bulkFileName}</p> : null}
                </div>
                {bulkRows.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">
                      {bulkRows.length} client rows{bulkIssues.length > 0 ? ` · ${bulkIssues.length} rows need attention` : " · ready to import"}
                    </p>
                    <div className="max-h-56 overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Company Name</TableHead>
                            <TableHead>Number</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bulkRows.slice(0, 8).map((row, index) => (
                            <TableRow key={`${row.company}-${index}`}>
                              <TableCell>{row.company || "—"}</TableCell>
                              <TableCell>{row.phone || "—"}</TableCell>
                              <TableCell>{row.status || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {bulkRows.length > 8 ? (
                      <p className="text-xs text-muted-foreground">Showing the first 8 rows.</p>
                    ) : null}
                  </div>
                ) : null}
                {bulkIssues.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto rounded-md border border-destructive/30 p-3 text-sm text-destructive">
                    <ul className="flex flex-col gap-1">
                      {bulkIssues.slice(0, 20).map((issue) => (
                        <li key={issue.row}>Row {issue.row}: {issue.messages.join("; ")}</li>
                      ))}
                    </ul>
                    {bulkIssues.length > 20 ? <p className="mt-2">And {bulkIssues.length - 20} more rows.</p> : null}
                  </div>
                ) : null}
                {bulkError ? <p className="text-sm text-destructive">{bulkError}</p> : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBulkImport} disabled={bulkSubmitting || bulkRows.length === 0 || bulkIssues.length > 0}>
                  {bulkSubmitting ? "Importing…" : `Import ${bulkRows.length || "clients"}`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="client-phone">Phone number{!editingId ? " *" : ""}</Label>
                  <Input
                    id="client-phone"
                    type="tel"
                    className="h-10 text-base"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="e.g. +91 98765 43210"
                    maxLength={30}
                    required={!editingId}
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
                  <Label htmlFor="client-renewal">Renewal / expiry date</Label>
                  <Input
                    id="client-renewal"
                    type="date"
                    className="h-10 text-base"
                    value={form.renewalDate}
                    onChange={(e) => setForm((f) => ({ ...f, renewalDate: e.target.value }))}
                  />
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
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <SearchField
            className="w-full sm:max-w-sm"
            value={clientQuery}
            onChange={(e) => setClientQuery(e.target.value)}
            placeholder="Search clients by company, owner, ID…"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Total received</TableHead>
                <TableHead>Last receipt</TableHead>
                <TableHead>Renewal</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleClients.map((client) => (
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
                        {client.phone ? <div className="text-xs text-muted-foreground">{client.phone}</div> : null}
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
                  <TableCell className="text-right text-sm">
                    {formatCurrency(client.totalReceived)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(client.lastReceiptDate)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {client.renewalDate ? (
                      <span
                        className={cn(
                          renewalTone(client.renewalDate) === "overdue" && "font-medium text-destructive",
                          renewalTone(client.renewalDate) === "soon" && "font-medium text-amber-600"
                        )}
                      >
                        {formatDate(client.renewalDate)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {isOwner || client.ownerEmployeeId === currentEmployeeId ? (
                        <>
                          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${client.company}`} onClick={() => openEdit(client)}>
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${client.company}`}
                            onClick={() => {
                              setDeleteError(null)
                              setDeleteTarget(client)
                            }}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </>
                      ) : null}
                      <Link href={`/crm/clients/${client.id}`}>
                        <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {visibleClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                    {clientQuery ? "No clients match your search." : "No clients yet."}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteSubmitting) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.company}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the client and related contacts/reminders. Clients with payments, services, a balance, or a converted lead cannot be deleted; mark those clients Inactive instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteSubmitting}
              onClick={handleDeleteClient}
            >
              {deleteSubmitting ? "Deleting…" : "Delete client"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Download, IndianRupee, Plus, XCircle } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency, formatDate } from "@/lib/format"
import { downloadCsv } from "@/lib/export-csv"
import type { Payment, PaymentReminder } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

const emptyReminderForm = { clientId: "", dueDate: "", expectedAmount: "", notes: "" }

export function PaymentsClient({
  initialPayments,
  initialReminders,
  clients,
  canApprove,
}: {
  initialPayments: Payment[]
  initialReminders: PaymentReminder[]
  clients: { id: string; company: string }[]
  canApprove: boolean
}) {
  const [payments, setPayments] = useState(initialPayments)
  const [reminders, setReminders] = useState(initialReminders)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyReminderForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [decidingId, setDecidingId] = useState<string | null>(null)

  const totalCollected = useMemo(
    () =>
      payments
        .filter((p) => p.status === "Received" && p.approvalStatus === "Approved")
        .reduce((sum, p) => sum + p.amount, 0),
    [payments]
  )

  async function handleCreateReminder() {
    if (!form.clientId || !form.dueDate) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/payment-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? "Could not create the reminder.")
        return
      }
      const client = clients.find((c) => c.id === form.clientId)
      setReminders((prev) => [
        {
          id: body.id,
          clientId: form.clientId,
          clientCompany: client?.company ?? "—",
          dueDate: form.dueDate,
          expectedAmount: form.expectedAmount ? Number(form.expectedAmount) : null,
          status: "Pending",
          notes: form.notes || null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ])
      setForm(emptyReminderForm)
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  async function updateReminderStatus(id: string, status: "Done" | "Cancelled") {
    const res = await fetch(`/api/payment-reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return
    setReminders((prev) => prev.filter((r) => r.id !== id))
  }

  async function decidePayment(id: string, decision: "Approved" | "Rejected") {
    setDecidingId(id)
    try {
      const res = await fetch(`/api/payments/${id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      if (!res.ok) return
      setPayments((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, approvalStatus: decision, approvedAt: new Date().toISOString() } : p
        )
      )
    } finally {
      setDecidingId(null)
    }
  }

  function exportPayments() {
    downloadCsv(
      `payments-${new Date().toISOString().slice(0, 10)}.csv`,
      payments.map((p) => ({
        Client: p.clientCompany,
        Date: p.paymentDate,
        Method: p.method ?? "",
        Reference: p.reference ?? "",
        Amount: p.amount,
        Status: p.status,
        Approval: p.approvalStatus,
        Notes: p.notes ?? "",
        "Recorded by": p.recordedBy ?? "",
        "Approved by": p.approvedBy ?? "",
      }))
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payments"
        description="Receipts, dues and reminders for your clients."
        actions={
          <Button size="sm" nativeButton={false} render={<Link href="/payments/new" />}>
            <Plus /> Record payment
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Collected (shown below)" value={formatCurrency(totalCollected)} icon={IndianRupee} />
        <StatCard label="Payments logged" value={String(payments.length)} icon={IndianRupee} />
        <StatCard
          label="Awaiting Owner approval"
          value={String(payments.filter((p) => p.approvalStatus === "Pending").length)}
          icon={IndianRupee}
        />
        <StatCard label="Reminders pending" value={String(reminders.length)} icon={IndianRupee} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Recent payments</CardTitle>
              <CardDescription>
                {canApprove
                  ? "Most recent receipts first. Approve or reject pending entries on the right."
                  : "Most recent receipts first. New payments need Owner approval before they reduce a client's balance."}
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={exportPayments} disabled={payments.length === 0}>
              <Download /> Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
                  {canApprove ? <TableHead className="text-right">Action</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/crm/clients/${p.clientId}`} className="font-medium hover:underline">
                        {p.clientCompany}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(p.paymentDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.method ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(p.amount)}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.approvalStatus} />
                    </TableCell>
                    {canApprove ? (
                      <TableCell className="text-right">
                        {p.approvalStatus === "Pending" ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={decidingId === p.id}
                              onClick={() => decidePayment(p.id, "Approved")}
                            >
                              <CheckCircle2 className="text-emerald-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={decidingId === p.id}
                              onClick={() => decidePayment(p.id, "Rejected")}
                            >
                              <XCircle className="text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {p.approvedBy ? `by ${p.approvedBy}` : "—"}
                          </span>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canApprove ? 7 : 6} className="py-8 text-center text-sm text-muted-foreground">
                      No payments recorded yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Reminders</CardTitle>
              <CardDescription>Payments expected soon.</CardDescription>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button size="sm" variant="outline" />}>
                <Plus /> Add
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle className="text-lg">Add payment reminder</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-1">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="rem-client">Client</Label>
                    <Select value={form.clientId} onValueChange={(v) => setForm((f) => ({ ...f, clientId: v ?? "" }))}>
                      <SelectTrigger id="rem-client" className="h-10 w-full text-base">
                        <SelectValue placeholder="Select client">
                          {(v: string) => clients.find((c) => c.id === v)?.company ?? "Select client"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.company}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="rem-due">Due date</Label>
                      <Input
                        id="rem-due"
                        type="date"
                        className="h-10 text-base"
                        value={form.dueDate}
                        onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="rem-amount">Expected amount</Label>
                      <Input
                        id="rem-amount"
                        type="number"
                        className="h-10 text-base"
                        value={form.expectedAmount}
                        onChange={(e) => setForm((f) => ({ ...f, expectedAmount: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="rem-notes">Notes</Label>
                    <Textarea
                      id="rem-notes"
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateReminder} disabled={submitting}>
                    {submitting ? "Saving…" : "Add reminder"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {reminders.map((r) => (
              <div key={r.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{r.clientCompany}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {formatDate(r.dueDate)}
                      {r.expectedAmount ? ` · ${formatCurrency(r.expectedAmount)}` : ""}
                    </p>
                    {r.notes ? <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p> : null}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => updateReminderStatus(r.id, "Done")}>
                      <CheckCircle2 className="text-emerald-600" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => updateReminderStatus(r.id, "Cancelled")}>
                      <XCircle className="text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {reminders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No reminders pending.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

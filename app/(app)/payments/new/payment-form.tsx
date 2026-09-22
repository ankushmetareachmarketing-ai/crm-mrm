"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { useRole } from "@/components/role-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

const methods = ["Cash", "Bank Transfer", "UPI", "Cheque", "Other"]
const statuses = ["Received", "Pending", "Failed", "Refunded"]

export function PaymentForm({ clients }: { clients: { id: string; company: string; balance: number }[] }) {
  const router = useRouter()
  const { role } = useRole()
  const needsApproval = role !== "Owner" && role !== "HR"
  const [form, setForm] = useState({
    clientId: "",
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    method: "Bank Transfer",
    reference: "",
    status: "Received",
    notes: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!form.clientId || !form.amount || Number(form.amount) <= 0) {
      setError("Pick a client and enter a valid amount.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? "Could not record the payment.")
        return
      }
      router.push("/payments")
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="w-fit" nativeButton={false} render={<Link href="/payments" />}>
          <ArrowLeft /> Back to payments
        </Button>
        <PageHeader title="Record payment" description="Log a receipt against a client and update their balance." />
      </div>

      <Card className="max-w-3xl">
        <CardContent className="flex flex-col gap-5 py-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay-client">Client</Label>
            <Select value={form.clientId} onValueChange={(v) => setForm((f) => ({ ...f, clientId: v ?? "" }))}>
              <SelectTrigger id="pay-client" className="h-10 w-full text-base">
                <SelectValue placeholder="Select client">
                  {(v: string) => clients.find((c) => c.id === v)?.company ?? "Select client"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company} {c.balance > 0 ? `(due ₹${c.balance.toLocaleString("en-IN")})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-amount">Amount (₹)</Label>
              <Input
                id="pay-amount"
                type="number"
                className="h-10 text-base"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="e.g. 25000"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-date">Payment date</Label>
              <Input
                id="pay-date"
                type="date"
                className="h-10 text-base"
                value={form.paymentDate}
                onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-method">Method</Label>
              <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v ?? "" }))}>
                <SelectTrigger id="pay-method" className="h-10 w-full text-base">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-reference">Reference</Label>
              <Input
                id="pay-reference"
                className="h-10 text-base"
                value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                placeholder="e.g. UTR / cheque no."
              />
            </div>
          </div>

          {needsApproval ? (
            <p className="text-xs text-muted-foreground">
              This is submitted as a &quot;Received&quot; payment for HR to verify — it reduces the client&apos;s due
              balance only once approved.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v ?? "" }))}>
                <SelectTrigger id="pay-status" className="h-10 w-full text-base sm:w-64">
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
              <p className="text-xs text-muted-foreground">
                Only a &quot;Received&quot; payment reduces the client&apos;s due balance.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay-notes">Notes</Label>
            <Textarea
              id="pay-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/payments" />}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving…" : "Record payment"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

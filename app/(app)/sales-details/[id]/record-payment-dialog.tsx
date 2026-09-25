"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { IndianRupee } from "@/components/icons"
import { GST_TYPES, PAYMENT_METHODS as methods, splitPayment, type GstType } from "@/lib/billing"
import { formatCurrency } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

export function RecordPaymentDialog({
  clientId,
  dueTotal,
  defaultGstType,
  needsApproval,
}: {
  clientId: string
  /** GST-inclusive balance due — what the client actually owes. */
  dueTotal: number
  defaultGstType: GstType
  needsApproval: boolean
}) {
  const router = useRouter()
  const emptyForm = () => ({
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    method: methods[0],
    gstType: defaultGstType,
    reference: "",
    notes: "",
  })
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const amount = Number(form.amount)
  const split = amount > 0 ? splitPayment(amount, form.gstType) : null
  const remaining = amount > 0 ? dueTotal - amount : dueTotal

  async function handleSubmit() {
    if (!(amount > 0)) {
      setError("Enter the amount received.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, clientId, amount, status: "Received" }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? "Could not record the payment.")
        return
      }
      setOpen(false)
      setForm(emptyForm())
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <DialogTrigger render={<Button variant="outline" className="cursor-pointer" />}>
        <IndianRupee /> Add payment
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Add a payment from the client</DialogTitle>
          <DialogDescription>
            This amount is taken off the client&apos;s bill
            {needsApproval ? " after the Owner approves it." : "."} It clears the oldest bill first.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rp-amount">Amount paid (₹)</Label>
              <Input
                id="rp-amount"
                type="number"
                min="0"
                className="h-10 text-base"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder={dueTotal > 0 ? `Due ${dueTotal.toLocaleString("en-IN")}` : "e.g. 25000"}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rp-date">Payment date</Label>
              <Input
                id="rp-date"
                type="date"
                className="h-10 text-base"
                value={form.paymentDate}
                onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rp-gst">GST</Label>
              <Select
                value={form.gstType}
                onValueChange={(v) => setForm((f) => ({ ...f, gstType: (v as GstType) ?? f.gstType }))}
              >
                <SelectTrigger id="rp-gst" className="h-10 w-full cursor-pointer text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GST_TYPES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g === "With GST" ? "With GST (amount includes 18%)" : "Without GST"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rp-method">Method</Label>
              <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v ?? f.method }))}>
                <SelectTrigger id="rp-method" className="h-10 w-full cursor-pointer text-base">
                  <SelectValue />
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
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rp-reference">Reference</Label>
            <Input
              id="rp-reference"
              className="h-10 text-base"
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              placeholder="e.g. UTR / cheque no."
            />
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            {split && form.gstType === "With GST" ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Without GST</span>
                <span>{formatCurrency(split.base)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Still to pay now</span>
              <span>{formatCurrency(dueTotal)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t pt-1">
              <span className="font-medium">{remaining < 0 ? "Extra paid after this" : "Still to pay after this"}</span>
              <span className="font-semibold">{formatCurrency(Math.abs(remaining))}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rp-notes">Notes</Label>
            <Textarea
              id="rp-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="cursor-pointer" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : needsApproval ? "Send to Owner" : "Add payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Clock, CreditCard, Info } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { TestingBadge } from "@/components/money-badges"
import {
  computeCharge,
  GST_TYPES,
  PAYMENT_METHODS,
  PAYMENT_TERMS,
  SERVICE_GROUPS,
  SERVICE_OPTIONS,
  testingServiceName,
  unitFor,
  type GstType,
  type PaymentTerms,
} from "@/lib/billing"
import { formatCurrency, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const CUSTOM = "__custom__"
const TESTING = "__testing__"

function serviceLabel(value: string) {
  if (!value) return "Select service"
  if (value === CUSTOM) return "Custom…"
  if (value === TESTING) return "Testing (trial credits)"
  return value
}

const TERMS_INFO: Record<PaymentTerms, { icon: typeof Clock; title: string; description: string }> = {
  "Pay later": { icon: Clock, title: "Will pay later", description: "Nothing paid today" },
  "Part payment": { icon: CreditCard, title: "Paying some now", description: "Some today, rest later" },
  "Paid in full": { icon: CheckCircle2, title: "Paying full now", description: "Whole amount paid today" },
}

function Section({
  step,
  title,
  description,
  children,
}: {
  step: number
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {step}
        </span>
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  )
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function SummaryRow({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className={cn(strong ? "font-medium" : "text-muted-foreground")}>{label}</span>
      <span className={cn(strong ? "text-base font-semibold" : "font-medium", tone)}>{value}</span>
    </div>
  )
}

export function NewServiceForm({
  clients,
  initialClientId,
  isOwner,
  paymentsNeedApproval,
}: {
  clients: { id: string; company: string; dueTotal: number }[]
  initialClientId: string
  isOwner: boolean
  paymentsNeedApproval: boolean
}) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    clientId: initialClientId,
    service: "",
    customService: "",
    testedService: "",
    chargeDate: today,
    quantity: "",
    rate: "",
    gstType: "With GST" as GstType,
    paymentTerms: "Pay later" as PaymentTerms,
    amountPaidNow: "",
    paymentMethod: PAYMENT_METHODS[0],
    paymentReference: "",
    dueDate: "",
    notes: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const selectedClient = clients.find((c) => c.id === form.clientId)
  const isTesting = form.service === TESTING
  const serviceName =
    form.service === CUSTOM
      ? form.customService.trim()
      : isTesting
        ? form.testedService
          ? testingServiceName(form.testedService)
          : ""
        : form.service
  // Labels and placeholders follow the chosen service (SMS count, IVR minutes, OBD calls…).
  const unit = form.service
    ? unitFor(isTesting ? testingServiceName("") : form.service === CUSTOM ? null : form.service)
    : null
  const quantityLabel = unit ? `Number of ${unit.plural}` : "Quantity"
  const rateLabel = unit ? `Cost per ${unit.singular} (₹)` : "Cost per unit (₹)"
  const quantity = Number(form.quantity)
  const rate = Number(form.rate)
  // Test credits may be free, so a rate of 0 is allowed only for Testing.
  const rateEntered = form.rate.trim() !== ""
  const rateOk = isTesting ? rateEntered && rate >= 0 : rate > 0
  const bill = quantity > 0 && rateOk ? computeCharge(quantity, rate, form.gstType) : null
  const total = bill?.total ?? 0
  const freeTest = isTesting && bill !== null && total === 0
  // A free test has nothing to pay, so no payment plan applies.
  const terms: PaymentTerms = freeTest ? "Paid in full" : form.paymentTerms
  const paidNow = terms === "Paid in full" ? total : terms === "Part payment" ? Number(form.amountPaidNow) || 0 : 0
  const onCredit = Math.max(total - paidNow, 0)
  const takesPaymentNow = !freeTest && terms !== "Pay later"
  const needsDueDate = !freeTest && terms !== "Paid in full"

  function validate(): string | null {
    if (!form.clientId) return "Select the client."
    if (!form.service) return "Select the service."
    if (isTesting && !form.testedService) return "Select which service the client will test."
    if (!serviceName) return "Enter the custom service name."
    if (!(quantity > 0)) return `Enter the ${quantityLabel.toLowerCase()}.`
    if (!rateOk) {
      return isTesting
        ? "Enter the cost per credit (0 if the test is free)."
        : `Enter the ${rateLabel.replace(" (₹)", "").toLowerCase()}.`
    }
    if (terms === "Part payment" && !(paidNow > 0 && paidNow < total)) {
      return "The amount paid now must be more than 0 and less than the total."
    }
    if (needsDueDate && !form.dueDate) return "Select the date by which the balance will be paid."
    if (needsDueDate && form.dueDate < form.chargeDate) return "The payment due date can't be before the service date."
    return null
  }

  async function handleSubmit() {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/clients/${form.clientId}/charges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: serviceName,
          quantity,
          rate,
          gstType: form.gstType,
          chargeDate: form.chargeDate,
          notes: form.notes,
          paymentTerms: terms,
          amountPaidNow: terms === "Part payment" ? paidNow : undefined,
          paymentMethod: takesPaymentNow ? form.paymentMethod : undefined,
          paymentReference: takesPaymentNow ? form.paymentReference : undefined,
          dueDate: needsDueDate ? form.dueDate : undefined,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? "Could not save this service.")
        return
      }
      router.push(`/sales-details/${form.clientId}`)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit cursor-pointer"
          nativeButton={false}
          render={<Link href="/services" />}
        >
          <ArrowLeft /> Back to services
        </Button>
        <PageHeader
          title="New service"
          description="Book a service for a client and record the payment terms agreed with them."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          <Section step={1} title="Client" description="Who is taking this service.">
            <Field
              label="Client"
              htmlFor="ns-client"
              hint={
                selectedClient && selectedClient.dueTotal > 0
                  ? `Existing balance due: ${formatCurrency(selectedClient.dueTotal)} — this service is added to it.`
                  : undefined
              }
            >
              <Select value={form.clientId} onValueChange={(v) => set("clientId", v ?? "")}>
                <SelectTrigger id="ns-client" className="h-10 w-full cursor-pointer text-base">
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
            </Field>
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No clients yet.{" "}
                <Link href="/crm/clients" className="font-medium text-foreground underline">
                  Add a client
                </Link>{" "}
                first.
              </p>
            ) : null}
          </Section>

          <Section step={2} title="Service" description="What is being provided, and when.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Service"
                htmlFor="ns-service"
                hint={
                  isTesting
                    ? "Trial credits so the client can try a service. Goes to the Owner for approval."
                    : unit && form.service !== CUSTOM
                      ? `Billed per ${unit.singular}.`
                      : undefined
                }
              >
                <Select value={form.service} onValueChange={(v) => set("service", v ?? form.service)}>
                  <SelectTrigger id="ns-service" className="h-10 w-full cursor-pointer text-base">
                    <SelectValue placeholder="Select service">{(v: string) => serviceLabel(v)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_GROUPS.map((g) => (
                      <SelectGroup key={g.label}>
                        <SelectLabel>{g.label}</SelectLabel>
                        {g.services.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Other</SelectLabel>
                      <SelectItem value={TESTING}>Testing (trial credits)</SelectItem>
                      <SelectItem value={CUSTOM}>Custom…</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Service date" htmlFor="ns-date">
                <Input
                  id="ns-date"
                  type="date"
                  className="h-10 text-base"
                  value={form.chargeDate}
                  onChange={(e) => set("chargeDate", e.target.value)}
                />
              </Field>
            </div>
            {isTesting ? (
              <Field label="Which service will the client test?" htmlFor="ns-tested">
                <Select value={form.testedService} onValueChange={(v) => set("testedService", v ?? "")}>
                  <SelectTrigger id="ns-tested" className="h-10 w-full cursor-pointer text-base sm:w-1/2">
                    <SelectValue placeholder="Select service to test">
                      {(v: string) => v || "Select service to test"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {form.service === CUSTOM ? (
              <Field label="Custom service name" htmlFor="ns-custom">
                <Input
                  id="ns-custom"
                  className="h-10 text-base"
                  value={form.customService}
                  onChange={(e) => set("customService", e.target.value)}
                  placeholder="e.g. Email, Missed call"
                  maxLength={60}
                  autoFocus
                />
              </Field>
            ) : null}
          </Section>

          <Section
            step={3}
            title="Pricing & GST"
            description={unit ? `This client's own rate per ${unit.singular}.` : "Select a service first to see its pricing fields."}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={quantityLabel} htmlFor="ns-qty" hint={unit?.quantityHint}>
                <Input
                  id="ns-qty"
                  type="number"
                  min="0"
                  className="h-10 text-base"
                  value={form.quantity}
                  onChange={(e) => set("quantity", e.target.value)}
                  placeholder={unit?.quantityPlaceholder ?? "Select a service first"}
                  disabled={!unit}
                />
              </Field>
              <Field
                label={rateLabel}
                htmlFor="ns-rate"
                hint={
                  isTesting
                    ? "Enter 0 if the test is free."
                    : unit
                      ? `Price agreed with this client per ${unit.singular}.`
                      : undefined
                }
              >
                <Input
                  id="ns-rate"
                  type="number"
                  min="0"
                  step="0.0001"
                  className="h-10 text-base"
                  value={form.rate}
                  onChange={(e) => set("rate", e.target.value)}
                  placeholder={unit?.ratePlaceholder ?? "Select a service first"}
                  disabled={!unit}
                />
              </Field>
            </div>
            <Field
              label="GST"
              htmlFor="ns-gst"
              hint={form.gstType === "With GST" ? "18% GST is added on top of the amount." : "No GST is charged."}
            >
              <Select value={form.gstType} onValueChange={(v) => set("gstType", (v as GstType) ?? form.gstType)}>
                <SelectTrigger id="ns-gst" className="h-10 w-full cursor-pointer text-base sm:w-1/2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GST_TYPES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g === "With GST" ? "With GST (+18%)" : g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Section>

          <Section step={4} title="Payment" description="How the client has agreed to pay for this service.">
            {freeTest ? (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <Info className="mt-0.5 size-5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">Free testing — nothing to pay</p>
                  <p className="text-emerald-800">
                    The client gets {quantity.toLocaleString("en-IN")} test credits at no cost. It is still recorded and
                    sent to the Owner for approval.
                  </p>
                </div>
              </div>
            ) : null}
            <div className={cn("grid gap-3 sm:grid-cols-3", freeTest && "hidden")} role="radiogroup" aria-label="Payment terms">
              {PAYMENT_TERMS.map((t) => {
                const info = TERMS_INFO[t]
                const Icon = info.icon
                const active = terms === t
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set("paymentTerms", t)}
                    className={cn(
                      "flex cursor-pointer flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                      active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent/50"
                    )}
                  >
                    <Icon className={cn("size-5", active ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-sm font-semibold">{info.title}</span>
                    <span className="text-xs text-muted-foreground">{info.description}</span>
                  </button>
                )
              })}
            </div>

            {!freeTest && terms === "Part payment" ? (
              <Field label="Amount paid now (₹)" htmlFor="ns-paid" hint={bill ? `Total is ${formatCurrency(total)}` : undefined}>
                <Input
                  id="ns-paid"
                  type="number"
                  min="0"
                  className="h-10 text-base sm:w-1/2"
                  value={form.amountPaidNow}
                  onChange={(e) => set("amountPaidNow", e.target.value)}
                  placeholder="e.g. 5000"
                />
              </Field>
            ) : null}

            {takesPaymentNow ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Payment method" htmlFor="ns-method">
                  <Select value={form.paymentMethod} onValueChange={(v) => set("paymentMethod", v ?? form.paymentMethod)}>
                    <SelectTrigger id="ns-method" className="h-10 w-full cursor-pointer text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Reference" htmlFor="ns-ref">
                  <Input
                    id="ns-ref"
                    className="h-10 text-base"
                    value={form.paymentReference}
                    onChange={(e) => set("paymentReference", e.target.value)}
                    placeholder="e.g. UTR / cheque no."
                  />
                </Field>
              </div>
            ) : null}

            {needsDueDate ? (
              <Field
                label="Balance to be paid by"
                htmlFor="ns-due"
                hint="A payment reminder is created for this date."
              >
                <Input
                  id="ns-due"
                  type="date"
                  min={form.chargeDate}
                  className="h-10 text-base sm:w-1/2"
                  value={form.dueDate}
                  onChange={(e) => set("dueDate", e.target.value)}
                />
              </Field>
            ) : null}

            {paymentsNeedApproval ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This {isTesting ? "testing request" : "service"}
                {takesPaymentNow ? " and its payment" : ""} will be sent to the Owner for approval. It is
                added to the client&apos;s balance — and the payment deducted — only after the Owner approves.
              </p>
            ) : null}

            <Field label="Notes" htmlFor="ns-notes">
              <Textarea id="ns-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </Section>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
              <CardDescription>{selectedClient?.company ?? "No client selected"}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <SummaryRow label="Service" value={serviceName || "—"} />
              {isTesting ? (
                <div className="flex justify-end">
                  <TestingBadge free={freeTest} />
                </div>
              ) : null}
              <SummaryRow label="Service date" value={formatDate(form.chargeDate)} />
              <SummaryRow
                label={unit ? `${unit.plural} × rate` : "Quantity × rate"}
                value={bill ? `${quantity.toLocaleString("en-IN")} × ₹${rate}` : "—"}
              />
              <div className="border-t" />
              <SummaryRow label="Amount (without GST)" value={bill ? formatCurrency(bill.base) : "—"} />
              <SummaryRow
                label={form.gstType === "With GST" ? "GST 18%" : "GST"}
                value={bill ? (bill.gst ? formatCurrency(bill.gst) : "Not applicable") : "—"}
              />
              <SummaryRow label="Total payable" value={bill ? formatCurrency(total) : "—"} strong />
              <div className="border-t" />
              <SummaryRow label="Paid now" value={formatCurrency(paidNow)} tone="text-emerald-700" />
              <SummaryRow
                label="On credit"
                value={formatCurrency(onCredit)}
                tone={onCredit > 0 ? "text-destructive" : undefined}
              />
              {needsDueDate ? (
                <SummaryRow label="Due by" value={form.dueDate ? formatDate(form.dueDate) : "—"} />
              ) : null}
              {!isOwner && bill && form.gstType === "With GST" ? (
                <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Your dashboard counts {formatCurrency(bill.base)} — amounts without GST.
                </p>
              ) : null}

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button
                className="mt-1 h-11 w-full cursor-pointer text-base font-semibold"
                onClick={handleSubmit}
                disabled={submitting || clients.length === 0}
              >
                {submitting
                  ? "Saving…"
                  : paymentsNeedApproval
                    ? isTesting
                      ? "Send testing request"
                      : "Submit for approval"
                    : isTesting
                      ? "Give test credits"
                      : "Book service"}
              </Button>
              <Button
                variant="outline"
                className="w-full cursor-pointer"
                nativeButton={false}
                render={<Link href="/services" />}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

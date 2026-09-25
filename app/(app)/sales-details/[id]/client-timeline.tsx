"use client"

import { CheckCircle2, History, IndianRupee, Layers, XCircle } from "@/components/icons"
import type { IconComponent } from "@/components/icons"
import { ApprovalBadge } from "@/components/money-badges"
import { ApprovalActions } from "@/components/approval-actions"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format"
import {
  isTestingService,
  PAYMENT_TERMS_LABEL,
  testedServiceOf,
  unitFor,
  type LedgerEntry,
  type TimelineEvent,
} from "@/lib/billing"
import { cn } from "@/lib/utils"

function amountOf(e: LedgerEntry, isOwner: boolean) {
  return isOwner ? e.total : e.base
}

function serviceLine(e: LedgerEntry, isOwner: boolean) {
  if (e.quantity === null || e.rate === null) return e.notes ?? "Balance carried forward"
  const unit = unitFor(e.label)
  const qty = `${e.quantity.toLocaleString("en-IN")} ${unit.plural} × ₹${e.rate} = ${formatCurrency(e.base)}`
  const gst = isOwner && e.gst > 0 ? ` + GST ${formatCurrency(e.gst)} = ${formatCurrency(e.total)}` : ""
  const terms = e.paymentTerms ? ` · ${PAYMENT_TERMS_LABEL[e.paymentTerms]}` : ""
  const due = e.dueDate ? `, rest to be paid by ${formatDate(e.dueDate)}` : ""
  return `${qty}${gst}${terms}${due}`
}

function paymentLine(e: LedgerEntry) {
  return [e.label, e.reference ? `Ref ${e.reference}` : null, `paid on ${formatDate(e.date)}`]
    .filter(Boolean)
    .join(" · ")
}

function describe(ev: TimelineEvent, isOwner: boolean): { icon: IconComponent; tone: string; title: string; detail: string } {
  const e = ev.entry
  const who = ev.actor ?? "Someone"
  const what =
    e.type === "charge"
      ? e.isOpeningBalance
        ? "the old balance"
        : isTestingService(e.label)
          ? `the ${testedServiceOf(e.label)} testing request`
          : `the ${e.label} service`
      : "the payment"
  const amount = formatCurrency(amountOf(e, isOwner))

  if (ev.kind === "approved") {
    return {
      icon: CheckCircle2,
      tone: "bg-emerald-100 text-emerald-700",
      title: `${who} approved ${what} of ${amount}`,
      detail: e.type === "charge" ? "Added to the client's bill." : "Taken off the client's bill.",
    }
  }
  if (ev.kind === "rejected") {
    return {
      icon: XCircle,
      tone: "bg-rose-100 text-rose-700",
      title: `${who} rejected ${what} of ${amount}`,
      detail: "Not counted in the bill.",
    }
  }
  if (e.type === "charge") {
    if (e.isOpeningBalance) {
      return {
        icon: History,
        tone: "bg-slate-100 text-slate-600",
        title: `Old balance of ${amount} brought in`,
        detail: "Amount the client already owed before this system.",
      }
    }
    if (isTestingService(e.label)) {
      const credits = (e.quantity ?? 0).toLocaleString("en-IN")
      return {
        icon: Layers,
        tone: "bg-fuchsia-100 text-fuchsia-700",
        title:
          e.total === 0
            ? `${who} asked for ${credits} free test credits (${testedServiceOf(e.label)})`
            : `${who} asked for ${credits} test credits (${testedServiceOf(e.label)}) for ${amount}`,
        detail: e.total === 0 ? "Trial so the client can try the service — nothing to pay." : serviceLine(e, isOwner),
      }
    }
    return {
      icon: Layers,
      tone: "bg-sky-100 text-sky-700",
      title: `${who} added a ${e.label} service of ${amount}`,
      detail: serviceLine(e, isOwner),
    }
  }
  return {
    icon: IndianRupee,
    tone: "bg-violet-100 text-violet-700",
    title: `${who} added a payment of ${amount}`,
    detail: paymentLine(e) + (e.chargeId ? " · paid while taking the service" : ""),
  }
}

export function ClientTimeline({ events, isOwner }: { events: TimelineEvent[]; isOwner: boolean }) {
  const newestFirst = [...events].reverse()

  if (newestFirst.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No activity yet.</p>
  }

  return (
    <ol className="relative flex flex-col">
      {newestFirst.map((ev, i) => {
        const d = describe(ev, isOwner)
        const Icon = d.icon
        const isLast = i === newestFirst.length - 1
        const e = ev.entry
        const awaiting = ev.kind === "submitted" && e.approvalStatus === "Pending"
        // A booking payment is decided together with its service, so only the service gets buttons.
        const canDecideHere = isOwner && awaiting && !(e.type === "payment" && e.chargeId)
        const balance = isOwner ? ev.balanceTotal : ev.balanceBase

        return (
          <li key={ev.key} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast ? <span className="absolute top-9 bottom-0 left-[17px] w-px bg-border" aria-hidden /> : null}
            <span className={cn("relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full", d.tone)}>
              <Icon className="size-4.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{d.title}</p>
                  {ev.kind === "submitted" || (ev.kind === "recorded" && !e.isOpeningBalance) ? (
                    <ApprovalBadge status={e.approvalStatus} kind={e.type === "charge" ? "service" : "payment"} />
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{d.detail}</p>
                {balance !== null ? (
                  <p className="mt-1.5 text-sm">
                    Still to pay after this:{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        balance > 0 ? "text-destructive" : balance < 0 ? "text-sky-700" : "text-muted-foreground"
                      )}
                    >
                      {balance < 0 ? `${formatCurrency(-balance)} extra paid` : formatCurrency(balance)}
                    </span>
                  </p>
                ) : null}
                {awaiting && e.type === "payment" && e.chargeId ? (
                  <p className="mt-1 text-xs text-muted-foreground">Will be approved together with its service.</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                <time className="text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(ev.at)}</time>
                {canDecideHere ? <ApprovalActions kind={e.type === "charge" ? "service" : "payment"} id={e.id} /> : null}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

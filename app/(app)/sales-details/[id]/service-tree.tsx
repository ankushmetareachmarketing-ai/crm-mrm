"use client"

import { CalendarClock, History, IndianRupee, Layers } from "@/components/icons"
import { ApprovalActions } from "@/components/approval-actions"
import { AdvanceBadge, ApprovalBadge, PaidStateBadge, TermsBadge, TestingBadge } from "@/components/money-badges"
import { formatCurrency, formatDate } from "@/lib/format"
import { isTestingService, unitFor, type ServiceNode, type TreePayment } from "@/lib/billing"
import { cn } from "@/lib/utils"

function money(base: number, total: number, isOwner: boolean) {
  return formatCurrency(isOwner ? total : base)
}

/** One branch under a service: a line connecting it to the service above. */
function Branch({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <li className="relative pl-8">
      {/* vertical line down from the parent (stops half-way on the last branch) */}
      <span
        aria-hidden
        className={cn("absolute left-3 w-0.5 bg-border", last ? "top-0 h-1/2" : "top-0 bottom-0")}
      />
      {/* elbow into this branch */}
      <span aria-hidden className="absolute top-1/2 left-3 h-0.5 w-4 bg-border" />
      {children}
    </li>
  )
}

function PaymentRow({
  p,
  isOwner,
  serviceIsPending,
}: {
  p: TreePayment
  isOwner: boolean
  serviceIsPending: boolean
}) {
  const e = p.entry
  const split = Math.abs(p.portionTotal - e.total) > 0.005
  // A payment taken while booking is decided together with its (pending) service.
  const decidedWithService = e.chargeId !== null && serviceIsPending
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
        e.approvalStatus === "Approved" && "border-emerald-200 bg-emerald-50/50",
        e.approvalStatus === "Pending" && "border-amber-200 bg-amber-50/60",
        e.approvalStatus === "Rejected" && "border-rose-200 bg-rose-50/50 opacity-75"
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 ring-1 ring-emerald-200">
          <IndianRupee className="size-4" />
        </span>
        <div>
          <p className={cn("text-sm font-semibold", e.approvalStatus === "Rejected" && "line-through")}>
            Paid {money(p.portionBase, p.portionTotal, isOwner)}
            {split ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                (part of a {money(e.base, e.total, isOwner)} payment)
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">
            {[e.label, e.reference ? `Ref ${e.reference}` : null, formatDate(e.date), e.recordedBy ? `added by ${e.recordedBy}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {e.approvalStatus === "Pending" ? (
            <p className="mt-0.5 text-xs text-amber-800">
              {decidedWithService
                ? "Will be approved together with this service."
                : "Not taken off the bill until the Owner approves."}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
        <ApprovalBadge status={e.approvalStatus} kind="payment" />
        {isOwner && e.approvalStatus === "Pending" && !decidedWithService ? (
          <ApprovalActions kind="payment" id={e.id} />
        ) : null}
      </div>
    </div>
  )
}

export function ServiceNodeCard({
  node,
  isOwner,
  fromEarlierMonth,
}: {
  node: ServiceNode
  isOwner: boolean
  fromEarlierMonth: boolean
}) {
  const s = node.service
  const pending = s.approvalStatus === "Pending"
  const rejected = s.approvalStatus === "Rejected"
  const unit = unitFor(s.label)
  const left = isOwner ? node.leftTotal : node.leftBase
  const today = new Date().toISOString().slice(0, 10)
  const overdue = !pending && !rejected && left > 0.005 && s.dueDate !== null && s.dueDate < today
  const Icon = s.isOpeningBalance ? History : Layers
  const testing = isTestingService(s.label)
  const freeTest = testing && s.total === 0

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-xs",
        pending && "border-amber-300 ring-1 ring-amber-200",
        rejected && "border-rose-200 opacity-70"
      )}
    >
      {/* Service (the parent of the branch) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              pending ? "bg-amber-100 text-amber-700" : rejected ? "bg-rose-100 text-rose-700" : "bg-primary/10 text-primary"
            )}
          >
            <Icon className="size-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn("text-base font-semibold", rejected && "line-through")}>
                {s.isOpeningBalance ? "Old balance" : s.label}
              </p>
              {fromEarlierMonth ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  From {formatDate(s.date)}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {s.isOpeningBalance
                ? "Amount the client already owed before this system."
                : `${(s.quantity ?? 0).toLocaleString("en-IN")} ${unit.plural} × ₹${s.rate} per ${unit.singular}`}
            </p>
            {!s.isOpeningBalance ? (
              <p className="text-xs text-muted-foreground">
                Given on {formatDate(s.date)}
                {s.recordedBy ? ` · added by ${s.recordedBy}` : ""}
                {s.approvedBy && s.approvalStatus !== "Pending" ? ` · ${rejected ? "rejected" : "approved"} by ${s.approvedBy}` : ""}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="text-lg font-bold">
            {money(s.base, s.total, isOwner)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {isOwner ? (s.gst > 0 ? `bill incl. GST ${formatCurrency(s.gst)}` : "bill, no GST") : "bill"}
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5 sm:justify-end">
            <ApprovalBadge status={s.approvalStatus} kind="service" />
            {testing ? <TestingBadge free={freeTest} /> : null}
            {!pending && !rejected && !freeTest ? <PaidStateBadge state={node.paidState} /> : null}
            {s.paymentTerms && !freeTest ? <TermsBadge terms={s.paymentTerms} /> : null}
          </div>
        </div>
      </div>

      {pending ? (
        <div className="mt-3 flex flex-col gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <span>Not added to the client&apos;s bill until the Owner approves it.</span>
          {isOwner ? <ApprovalActions kind="service" id={s.id} /> : null}
        </div>
      ) : null}

      {/* Branches: every payment for this service, then what is left */}
      {!rejected ? (
        <ul className="mt-3">
          {node.payments.map((p) => (
            <Branch key={`${p.entry.id}-${s.id}`}>
              <div className="py-1.5">
                <PaymentRow p={p} isOwner={isOwner} serviceIsPending={pending} />
              </div>
            </Branch>
          ))}
          <Branch last>
            <div className="py-1.5">
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg border-2 border-dashed px-3 py-2.5",
                  pending
                    ? "border-amber-200 text-amber-800"
                    : left > 0.005
                      ? "border-rose-200 bg-rose-50/40"
                      : "border-emerald-200 bg-emerald-50/40"
                )}
              >
                <div>
                  <p className="text-sm font-semibold">
                    {freeTest
                      ? "Free test — nothing to pay"
                      : pending
                        ? "Not counted yet"
                        : left > 0.005
                          ? "Still to pay"
                          : "Nothing left to pay"}
                  </p>
                  {!pending && left > 0.005 && s.dueDate ? (
                    <p className={cn("flex items-center gap-1 text-xs", overdue ? "font-semibold text-rose-700" : "text-muted-foreground")}>
                      <CalendarClock className="size-3.5" />
                      {overdue ? `Late — was due on ${formatDate(s.dueDate)}` : `Pay by ${formatDate(s.dueDate)}`}
                    </p>
                  ) : null}
                </div>
                {!pending ? (
                  <span className={cn("text-base font-bold", left > 0.005 ? "text-rose-700" : "text-emerald-700")}>
                    {formatCurrency(Math.max(left, 0))}
                  </span>
                ) : null}
              </div>
            </div>
          </Branch>
        </ul>
      ) : (
        <p className="mt-3 text-sm text-rose-700">The Owner rejected this service, so it is not part of the bill.</p>
      )}
    </div>
  )
}

export function ExtraPaymentsCard({
  advance,
  unplacedPending,
  isOwner,
}: {
  advance: TreePayment[]
  unplacedPending: TreePayment[]
  isOwner: boolean
}) {
  if (advance.length === 0 && unplacedPending.length === 0) return null
  const advanceTotal = advance.reduce((sum, p) => sum + (isOwner ? p.portionTotal : p.portionBase), 0)
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-base font-semibold">Payments not linked to a bill</p>
          <p className="text-sm text-muted-foreground">
            {advance.length > 0
              ? "The client paid more than their bills. This extra amount is used for the next service."
              : "These payments will be matched to the next bill once approved."}
          </p>
        </div>
        {advance.length > 0 ? (
          <div className="flex items-center gap-2">
            <AdvanceBadge />
            <span className="text-lg font-bold text-sky-700">{formatCurrency(advanceTotal)}</span>
          </div>
        ) : null}
      </div>
      <ul className="mt-3">
        {[...advance, ...unplacedPending].map((p, i, all) => (
          <Branch key={`${p.entry.id}-extra-${i}`} last={i === all.length - 1}>
            <div className="py-1.5">
              <PaymentRow p={p} isOwner={isOwner} serviceIsPending={false} />
            </div>
          </Branch>
        ))}
      </ul>
    </div>
  )
}

import { CheckCircle2, CircleDashed, CircleDot, Clock, PiggyBank, XCircle } from "@/components/icons"
import type { IconComponent } from "@/components/icons"
import { PAYMENT_TERMS_LABEL, type ApprovalStatus, type PaidState, type PaymentTerms } from "@/lib/billing"
import { cn } from "@/lib/utils"

// One visual language for money across Services, Sales Details and the
// client page:
//   • Owner decision  → soft tint + icon   (amber waiting / green approved / red rejected)
//   • Payment state   → solid fill         (green fully paid / blue partly paid / red not paid)
//   • Payment promise → plain outline      (what was agreed at booking)

function Pill({
  icon: Icon,
  className,
  children,
}: {
  icon?: IconComponent
  className: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        className
      )}
    >
      {Icon ? <Icon className="size-3.5" /> : null}
      {children}
    </span>
  )
}

export function ApprovalBadge({ status, kind }: { status: ApprovalStatus; kind: "service" | "payment" }) {
  if (status === "Pending") {
    return (
      <Pill icon={Clock} className="border border-amber-300 bg-amber-50 text-amber-800">
        Waiting for Owner
      </Pill>
    )
  }
  if (status === "Rejected") {
    return (
      <Pill icon={XCircle} className="border border-rose-300 bg-rose-50 text-rose-700">
        Rejected
      </Pill>
    )
  }
  return (
    <Pill icon={CheckCircle2} className="border border-emerald-300 bg-emerald-50 text-emerald-700">
      {kind === "service" ? "Active" : "Approved"}
    </Pill>
  )
}

export function PaidStateBadge({ state }: { state: PaidState }) {
  if (state === "Fully paid") {
    return (
      <Pill icon={CheckCircle2} className="bg-emerald-600 text-white">
        Fully paid
      </Pill>
    )
  }
  if (state === "Partly paid") {
    return (
      <Pill icon={CircleDot} className="bg-blue-600 text-white">
        Partly paid
      </Pill>
    )
  }
  return (
    <Pill icon={CircleDashed} className="bg-rose-600 text-white">
      Not paid
    </Pill>
  )
}

export function TermsBadge({ terms }: { terms: PaymentTerms }) {
  return <Pill className="border border-slate-300 bg-white text-slate-700">{PAYMENT_TERMS_LABEL[terms]}</Pill>
}

export function AdvanceBadge() {
  return (
    <Pill icon={PiggyBank} className="bg-sky-600 text-white">
      Extra paid
    </Pill>
  )
}

/** Marks trial credits given so a client can test a service; "Free test" when it costs nothing. */
export function TestingBadge({ free }: { free?: boolean }) {
  return <Pill className="bg-fuchsia-600 text-white">{free ? "Free test" : "Testing"}</Pill>
}

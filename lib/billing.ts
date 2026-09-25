// Shared (client + server) rules for the credit-sales ledger: services a
// client takes are charges, payments are credits, and the due is always
// approved charges - approved received payments. Only the Owner approves.
// See supabase/migrations/20260924000000_client_charges_and_gst.sql and
// 20260924010000_charge_approvals.sql.

export type GstType = "With GST" | "Non GST"
export type ApprovalStatus = "Pending" | "Approved" | "Rejected"

export const GST_TYPES: GstType[] = ["With GST", "Non GST"]
export const GST_RATE = 0.18
export const SERVICE_OPTIONS = ["SMS", "RCS", "WhatsApp", "IVR", "OBD", "SMS Campaign", "Voice Campaign"]

/** How the service dropdown is grouped. "Testing" and "Custom…" are added by the form. */
export const SERVICE_GROUPS: { label: string; services: string[] }[] = [
  { label: "Messaging", services: ["SMS", "RCS", "WhatsApp"] },
  { label: "Voice", services: ["IVR", "OBD"] },
  { label: "Campaigns", services: ["SMS Campaign", "Voice Campaign"] },
]

/**
 * Test credits given so a client can try a service before buying. Stored as
 * "Testing – <service>" (e.g. "Testing – WhatsApp"). It may be free (rate 0)
 * and, like every service, goes to the Owner for approval.
 */
export const TESTING_PREFIX = "Testing"

export function isTestingService(service: string | null | undefined) {
  return Boolean(service && (service === TESTING_PREFIX || service.startsWith(`${TESTING_PREFIX} – `)))
}

export function testingServiceName(testedService: string) {
  return `${TESTING_PREFIX} – ${testedService}`
}

/** "Testing – WhatsApp" → "WhatsApp"; anything else is returned as is. */
export function testedServiceOf(service: string) {
  return isTestingService(service) ? service.slice(TESTING_PREFIX.length + 3) || service : service
}

/** How each service is counted and priced, for form labels, placeholders and descriptions. */
export interface ServiceUnit {
  /** Plural noun used in labels and summaries, e.g. "minutes". */
  plural: string
  /** Singular noun used for the rate, e.g. "minute". */
  singular: string
  quantityHint: string
  quantityPlaceholder: string
  ratePlaceholder: string
}

const SERVICE_UNITS: Record<string, ServiceUnit> = {
  SMS: {
    plural: "SMS",
    singular: "SMS",
    quantityHint: "Total SMS credits given to the client.",
    quantityPlaceholder: "e.g. 1,00,000",
    ratePlaceholder: "e.g. 0.12",
  },
  RCS: {
    plural: "RCS messages",
    singular: "RCS message",
    quantityHint: "Total RCS messages given to the client.",
    quantityPlaceholder: "e.g. 50,000",
    ratePlaceholder: "e.g. 0.25",
  },
  WhatsApp: {
    plural: "WhatsApp messages",
    singular: "WhatsApp message",
    quantityHint: "Total WhatsApp messages / conversations given to the client.",
    quantityPlaceholder: "e.g. 25,000",
    ratePlaceholder: "e.g. 0.80",
  },
  IVR: {
    plural: "IVR minutes",
    singular: "minute",
    quantityHint: "Total IVR minutes given to the client.",
    quantityPlaceholder: "e.g. 10,000",
    ratePlaceholder: "e.g. 0.35",
  },
  OBD: {
    plural: "OBD calls",
    singular: "call",
    quantityHint: "Total outbound dialer (OBD) calls given to the client.",
    quantityPlaceholder: "e.g. 50,000",
    ratePlaceholder: "e.g. 0.18",
  },
  "SMS Campaign": {
    plural: "campaign SMS",
    singular: "SMS",
    quantityHint: "Total SMS sent in this campaign.",
    quantityPlaceholder: "e.g. 2,00,000",
    ratePlaceholder: "e.g. 0.11",
  },
  "Voice Campaign": {
    plural: "campaign calls",
    singular: "call",
    quantityHint: "Total voice calls made in this campaign.",
    quantityPlaceholder: "e.g. 50,000",
    ratePlaceholder: "e.g. 0.20",
  },
}

const TESTING_UNIT: ServiceUnit = {
  plural: "test credits",
  singular: "credit",
  quantityHint: "Credits given to the client to try the service.",
  quantityPlaceholder: "e.g. 500",
  ratePlaceholder: "0 if the test is free",
}

const CUSTOM_UNIT: ServiceUnit = {
  plural: "units",
  singular: "unit",
  quantityHint: "Total units of this service given to the client.",
  quantityPlaceholder: "e.g. 1,000",
  ratePlaceholder: "e.g. 1.50",
}

export function unitFor(service: string | null | undefined): ServiceUnit {
  if (isTestingService(service)) return TESTING_UNIT
  return (service && SERVICE_UNITS[service]) || CUSTOM_UNIT
}

/** Agreed when a service is booked. */
export type PaymentTerms = "Pay later" | "Paid in full" | "Part payment"
export const PAYMENT_TERMS: PaymentTerms[] = ["Pay later", "Part payment", "Paid in full"]
export const PAYMENT_METHODS = ["Bank Transfer", "UPI", "Cash", "Cheque", "Other"]

function round2(n: number) {
  return Math.round(n * 100) / 100
}

/** quantity × per-unit rate, plus 18% on top when "With GST". */
export function computeCharge(quantity: number, rate: number, gstType: GstType) {
  const base = round2(quantity * rate)
  const gst = gstType === "With GST" ? round2(base * GST_RATE) : 0
  return { base, gst, total: round2(base + gst) }
}

/** A "With GST" receipt already includes the 18%, so its ex-GST part is amount / 1.18. */
export function splitPayment(amount: number, gstType: GstType) {
  const base = gstType === "With GST" ? round2(amount / (1 + GST_RATE)) : round2(amount)
  return { base, gst: round2(amount - base), total: round2(amount) }
}

export interface LedgerEntry {
  id: string
  type: "charge" | "payment"
  /** Service date for a charge, payment date for a payment. */
  date: string
  /** ISO timestamp the entry was submitted. */
  createdAt: string
  /** Service name for a charge ("Opening balance" for carried-forward rows), method for a payment. */
  label: string
  isOpeningBalance: boolean
  quantity: number | null
  rate: number | null
  reference: string | null
  gstType: GstType
  base: number
  gst: number
  total: number
  /** Only Owner-approved entries move the balance. */
  countsTowardBalance: boolean
  approvalStatus: ApprovalStatus
  approvedBy: string | null
  /** ISO timestamp of the Owner's decision (approval or rejection). */
  approvedAt: string | null
  /** Payments only: the service this was paid against at booking. */
  chargeId: string | null
  /** Charges only: terms agreed at booking, and when any credited balance is due. */
  paymentTerms: PaymentTerms | null
  dueDate: string | null
  notes: string | null
  recordedBy: string | null
}

export interface ClientLedgerSummary {
  clientId: string
  company: string
  status: string
  ownerEmployeeId: string | null
  ownerName: string | null
  billedBase: number
  billedTotal: number
  receivedBase: number
  receivedTotal: number
  /** Payments awaiting the Owner's approval. */
  pendingApprovalBase: number
  pendingApprovalTotal: number
  /** Services awaiting the Owner's approval. */
  pendingServicesBase: number
  pendingServicesTotal: number
  dueBase: number
  dueTotal: number
}

export interface MonthSummary {
  openingBase: number
  openingTotal: number
  billedBase: number
  billedGst: number
  billedTotal: number
  receivedBase: number
  receivedTotal: number
  pendingApprovalBase: number
  pendingApprovalTotal: number
  pendingServicesBase: number
  pendingServicesTotal: number
  closingBase: number
  closingTotal: number
}

export function monthKey(date: string) {
  return date.slice(0, 7)
}

export function currentMonthKey() {
  return new Date().toISOString().slice(0, 7)
}

export function formatMonth(key: string) {
  const date = new Date(`${key}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return key
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(date)
}

/** Ledger entries sorted oldest-first, each with the running balance after it. */
export function withRunningBalance(entries: LedgerEntry[]) {
  const sorted = [...entries].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.createdAt.localeCompare(b.createdAt) ||
      (a.type === b.type ? 0 : a.type === "charge" ? -1 : 1)
  )
  let base = 0
  let total = 0
  return sorted.map((e) => {
    if (e.countsTowardBalance) {
      const sign = e.type === "charge" ? 1 : -1
      base = round2(base + sign * e.base)
      total = round2(total + sign * e.total)
    }
    return { ...e, balanceBase: base, balanceTotal: total }
  })
}

/** Opening due carried in from earlier months, this month's billing and receipts, and the closing due. */
export function summarizeMonth(entries: LedgerEntry[], month: string): MonthSummary {
  const s: MonthSummary = {
    openingBase: 0,
    openingTotal: 0,
    billedBase: 0,
    billedGst: 0,
    billedTotal: 0,
    receivedBase: 0,
    receivedTotal: 0,
    pendingApprovalBase: 0,
    pendingApprovalTotal: 0,
    pendingServicesBase: 0,
    pendingServicesTotal: 0,
    closingBase: 0,
    closingTotal: 0,
  }
  for (const e of entries) {
    const key = monthKey(e.date)
    if (key > month) continue
    if (e.approvalStatus === "Pending" && key === month) {
      if (e.type === "payment") {
        s.pendingApprovalBase += e.base
        s.pendingApprovalTotal += e.total
      } else {
        s.pendingServicesBase += e.base
        s.pendingServicesTotal += e.total
      }
    }
    if (!e.countsTowardBalance) continue
    const sign = e.type === "charge" ? 1 : -1
    if (key < month) {
      s.openingBase += sign * e.base
      s.openingTotal += sign * e.total
    } else if (e.type === "charge") {
      s.billedBase += e.base
      s.billedGst += e.gst
      s.billedTotal += e.total
    } else {
      s.receivedBase += e.base
      s.receivedTotal += e.total
    }
  }
  s.closingBase = s.openingBase + s.billedBase - s.receivedBase
  s.closingTotal = s.openingTotal + s.billedTotal - s.receivedTotal
  for (const k of Object.keys(s) as (keyof MonthSummary)[]) s[k] = round2(s[k])
  return s
}

/** Plain-language names for payment terms, shown everywhere instead of the stored values. */
export const PAYMENT_TERMS_LABEL: Record<PaymentTerms, string> = {
  "Pay later": "Will pay later",
  "Part payment": "Paid some now",
  "Paid in full": "Paid full now",
}

export type PaidState = "Not paid" | "Partly paid" | "Fully paid"

export interface TreePayment {
  entry: LedgerEntry
  /** Portion of this payment counted against this service (a payment can be split across bills). */
  portionBase: number
  portionTotal: number
  /** Pending payments are only shown where they will go; they don't reduce the bill yet. */
  counted: boolean
}

export interface ServiceNode {
  service: LedgerEntry
  payments: TreePayment[]
  paidBase: number
  paidTotal: number
  leftBase: number
  leftTotal: number
  paidState: PaidState
}

export interface ServiceTree {
  nodes: ServiceNode[]
  /** Approved money received beyond all approved bills. */
  advance: TreePayment[]
  /** Pending payments with no unpaid bill to go to yet. */
  unplacedPending: TreePayment[]
}

function byDate(a: LedgerEntry, b: LedgerEntry) {
  return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
}

/**
 * Connects every payment to the bill it pays off, so the client page can
 * show Service → its payments → what is still left. A payment taken while
 * booking goes to its own service; every other approved payment clears the
 * oldest unpaid bill first. Display-only: balances themselves always come
 * from approved charges − approved payments.
 */
export function buildServiceTree(entries: LedgerEntry[]): ServiceTree {
  const services = entries.filter((e) => e.type === "charge").sort(byDate)
  const payments = entries.filter((e) => e.type === "payment").sort(byDate)

  const nodes = new Map<string, ServiceNode>(
    services.map((s) => [
      s.id,
      { service: s, payments: [], paidBase: 0, paidTotal: 0, leftBase: s.base, leftTotal: s.total, paidState: "Not paid" },
    ])
  )
  const approvedNodes = services.filter((s) => s.approvalStatus === "Approved").map((s) => nodes.get(s.id)!)
  const advance: TreePayment[] = []
  const unplacedPending: TreePayment[] = []

  const place = (node: ServiceNode, entry: LedgerEntry, portionTotal: number, counted: boolean) => {
    const portionBase = entry.total > 0 ? round2((portionTotal / entry.total) * entry.base) : 0
    node.payments.push({ entry, portionBase, portionTotal: round2(portionTotal), counted })
    if (counted) {
      node.paidTotal = round2(node.paidTotal + portionTotal)
      node.paidBase = round2(node.paidBase + portionBase)
      node.leftTotal = round2(node.leftTotal - portionTotal)
      node.leftBase = round2(node.leftBase - portionBase)
    }
  }

  const spread = (entry: LedgerEntry, amount: number, startNode?: ServiceNode) => {
    let left = amount
    const order = startNode ? [startNode, ...approvedNodes.filter((n) => n !== startNode)] : approvedNodes
    for (const node of order) {
      if (left <= 0.005) break
      if (node.leftTotal <= 0.005) continue
      const take = Math.min(left, node.leftTotal)
      place(node, entry, take, true)
      left = round2(left - take)
    }
    if (left > 0.005) {
      advance.push({
        entry,
        portionTotal: left,
        portionBase: entry.total > 0 ? round2((left / entry.total) * entry.base) : 0,
        counted: true,
      })
    }
  }

  for (const p of payments) {
    const own = p.chargeId ? nodes.get(p.chargeId) : undefined
    if (p.approvalStatus === "Approved") {
      spread(p, p.total, own && own.service.approvalStatus === "Approved" ? own : undefined)
    } else if (own) {
      // Pending or rejected payment taken at booking: always shown under its own service.
      place(own, p, p.total, false)
    } else if (p.approvalStatus === "Pending") {
      const next = approvedNodes.find((n) => n.leftTotal > 0.005)
      if (next) place(next, p, p.total, false)
      else unplacedPending.push({ entry: p, portionBase: p.base, portionTotal: p.total, counted: false })
    }
    // A rejected standalone payment belongs to no bill; it still shows in the Activity log.
  }

  for (const node of nodes.values()) {
    node.paidState =
      node.leftTotal <= 0.005 ? "Fully paid" : node.paidTotal > 0.005 ? "Partly paid" : "Not paid"
  }

  return { nodes: services.map((s) => nodes.get(s.id)!), advance, unplacedPending }
}

export type TimelineEventKind = "submitted" | "approved" | "rejected" | "recorded"

export interface TimelineEvent {
  key: string
  at: string
  kind: TimelineEventKind
  entry: LedgerEntry
  actor: string | null
  /** Balance due right after this event — set only when the event moved the balance. */
  balanceBase: number | null
  balanceTotal: number | null
}

/**
 * Chronological audit trail: who submitted each service/payment, when the
 * Owner approved or rejected it, and the balance due after each approval.
 * An entry approved at the moment it was recorded (Owner's own entries,
 * opening balances) collapses into a single "recorded" event.
 */
export function buildTimeline(entries: LedgerEntry[]): TimelineEvent[] {
  const events: Omit<TimelineEvent, "balanceBase" | "balanceTotal">[] = []
  for (const e of entries) {
    const decidedAt = e.approvedAt ?? (e.approvalStatus === "Approved" ? e.createdAt : null)
    const immediate =
      e.approvalStatus === "Approved" &&
      decidedAt !== null &&
      Math.abs(new Date(decidedAt).getTime() - new Date(e.createdAt).getTime()) < 60_000 &&
      (e.approvedBy === null || e.approvedBy === e.recordedBy)

    if (immediate) {
      events.push({ key: `${e.id}-recorded`, at: e.createdAt, kind: "recorded", entry: e, actor: e.recordedBy })
      continue
    }
    events.push({ key: `${e.id}-submitted`, at: e.createdAt, kind: "submitted", entry: e, actor: e.recordedBy })
    if (e.approvalStatus !== "Pending" && decidedAt) {
      events.push({
        key: `${e.id}-${e.approvalStatus}`,
        at: decidedAt,
        kind: e.approvalStatus === "Approved" ? "approved" : "rejected",
        entry: e,
        actor: e.approvedBy,
      })
    }
  }

  // Oldest first so the running balance can be applied; a charge sorts
  // before its own booking payment when both are approved together.
  events.sort(
    (a, b) =>
      new Date(a.at).getTime() - new Date(b.at).getTime() ||
      (a.entry.type === b.entry.type ? 0 : a.entry.type === "charge" ? -1 : 1)
  )

  let base = 0
  let total = 0
  return events.map((ev) => {
    const moves = ev.kind === "approved" || ev.kind === "recorded"
    if (moves) {
      const sign = ev.entry.type === "charge" ? 1 : -1
      base = round2(base + sign * ev.entry.base)
      total = round2(total + sign * ev.entry.total)
    }
    return { ...ev, balanceBase: moves ? base : null, balanceTotal: moves ? total : null }
  })
}

"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CalendarRange, Clock, Plus } from "@/components/icons"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency } from "@/lib/format"
import {
  buildServiceTree,
  buildTimeline,
  currentMonthKey,
  formatMonth,
  monthKey,
  summarizeMonth,
  type LedgerEntry,
} from "@/lib/billing"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { ClientTimeline } from "./client-timeline"
import { RecordPaymentDialog } from "./record-payment-dialog"
import { ExtraPaymentsCard, ServiceNodeCard } from "./service-tree"

const ALL_MONTHS = "all"

function SumBox({
  label,
  hint,
  value,
  tone,
  strong,
}: {
  label: string
  hint: string
  value: number
  tone?: string
  strong?: boolean
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl border bg-card px-4 py-3",
        strong && "border-2 border-primary/40 bg-primary/5"
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("text-xl font-bold", tone)}>
        {value < 0 ? `${formatCurrency(-value)} extra` : formatCurrency(value)}
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}

function Operator({ symbol }: { symbol: "+" | "−" | "=" }) {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center self-center rounded-full bg-muted text-lg leading-none font-bold text-muted-foreground"
    >
      {symbol}
    </span>
  )
}

export function ClientStatementClient({
  client,
  entries,
  isOwner,
  paymentsNeedApproval,
}: {
  client: { id: string; company: string; status: string; ownerName: string | null }
  entries: LedgerEntry[]
  isOwner: boolean
  paymentsNeedApproval: boolean
}) {
  const [month, setMonth] = useState<string>(currentMonthKey())
  const isAll = month === ALL_MONTHS

  const monthOptions = useMemo(() => {
    const set = new Set(entries.map((e) => monthKey(e.date)))
    set.add(currentMonthKey())
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [entries])

  const tree = useMemo(() => buildServiceTree(entries), [entries])
  const timeline = useMemo(() => buildTimeline(entries), [entries])
  const summary = useMemo(() => summarizeMonth(entries, month), [entries, month])
  const overall = useMemo(() => summarizeMonth(entries, "9999-12"), [entries])

  // Services shown for the chosen month: those given this month, plus older
  // ones that are still unpaid or received a payment this month.
  const visibleNodes = useMemo(() => {
    const inMonth = (d: string) => isAll || monthKey(d) === month
    return tree.nodes
      .filter((n) => {
        if (inMonth(n.service.date)) return true
        if (isAll || monthKey(n.service.date) > month) return false
        const stillOwed = n.service.approvalStatus === "Approved" && n.leftTotal > 0.005
        return stillOwed || n.service.approvalStatus === "Pending" || n.payments.some((p) => inMonth(p.entry.date))
      })
      .sort((a, b) => {
        const aNow = inMonth(a.service.date) ? 1 : 0
        const bNow = inMonth(b.service.date) ? 1 : 0
        return bNow - aNow || b.service.date.localeCompare(a.service.date) || b.service.createdAt.localeCompare(a.service.createdAt)
      })
  }, [tree, month, isAll])

  const pendingCount = entries.filter(
    (e) => e.approvalStatus === "Pending" && !(e.type === "payment" && e.chargeId)
  ).length

  // Owner sees amounts with GST; Sales sees everything without GST.
  const pick = (base: number, total: number) => (isOwner ? total : base)
  const approvedSum = (type: LedgerEntry["type"]) =>
    entries
      .filter((e) => e.type === type && e.countsTowardBalance)
      .reduce((sum, e) => sum + pick(e.base, e.total), 0)
  const earlier = isAll ? 0 : pick(summary.openingBase, summary.openingTotal)
  const billed = isAll ? approvedSum("charge") : pick(summary.billedBase, summary.billedTotal)
  const received = isAll ? approvedSum("payment") : pick(summary.receivedBase, summary.receivedTotal)
  const stillToPay = isAll ? billed - received : pick(summary.closingBase, summary.closingTotal)
  const periodLabel = isAll ? "so far" : `in ${formatMonth(month)}`
  const defaultGstType = entries.some((e) => e.type === "charge" && e.gstType === "With GST") ? "With GST" : "Non GST"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit cursor-pointer"
          nativeButton={false}
          render={<Link href="/sales-details" />}
        >
          <ArrowLeft /> All clients
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{client.company}</h2>
              <StatusBadge status={client.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              Sales person: <span className="font-medium text-foreground">{client.ownerName ?? "Not assigned"}</span> ·{" "}
              {isOwner ? "Amounts include GST" : "Amounts are without GST"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={month} onValueChange={(m) => setMonth(m ?? currentMonthKey())}>
              <SelectTrigger className="h-10 w-52 cursor-pointer text-base">
                <CalendarRange className="size-4 text-muted-foreground" />
                <SelectValue>{(m: string) => (m === ALL_MONTHS ? "All months" : formatMonth(m))}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_MONTHS}>All months</SelectItem>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMonth(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="h-10 cursor-pointer"
              nativeButton={false}
              render={<Link href={`/services/new?client=${encodeURIComponent(client.id)}`} />}
            >
              <Plus /> Add service
            </Button>
            <RecordPaymentDialog
              clientId={client.id}
              dueTotal={overall.closingTotal}
              defaultGstType={defaultGstType}
              needsApproval={paymentsNeedApproval}
            />
          </div>
        </div>
      </div>

      {pendingCount > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <Clock className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">
              {pendingCount} {pendingCount === 1 ? "item is" : "items are"} waiting for the Owner
            </p>
            <p className="text-amber-800">
              {isOwner
                ? "Look for the yellow cards below and press Approve or Reject. Nothing changes in the bill until you do."
                : "These are not counted in the bill yet. They will be added as soon as the Owner approves them."}
            </p>
          </div>
        </div>
      ) : null}

      {/* The money story for the chosen period, as one connected sum */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        {!isAll ? (
          <>
            <SumBox label="Left from earlier months" hint="Not paid before this month" value={earlier} />
            <Operator symbol="+" />
          </>
        ) : null}
        <SumBox label="New bills" hint={`Approved services ${periodLabel}`} value={billed} />
        <Operator symbol="−" />
        <SumBox label="Paid" hint={`Approved payments ${periodLabel}`} value={received} tone="text-emerald-700" />
        <Operator symbol="=" />
        <SumBox
          label="Still to pay"
          hint={isAll ? "Total the client owes now" : `At the end of ${formatMonth(month)}`}
          value={stillToPay}
          tone={stillToPay > 0 ? "text-rose-700" : stillToPay < 0 ? "text-sky-700" : "text-emerald-700"}
          strong
        />
      </div>

      <Tabs defaultValue="tree">
        <TabsList className="h-11 p-1">
          <TabsTrigger value="tree" className="cursor-pointer px-4 py-1.5">
            Services &amp; payments
          </TabsTrigger>
          <TabsTrigger value="activity" className="cursor-pointer px-4 py-1.5">
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tree" className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Each service shows the payments made for it, and how much is still to pay. Payments clear the oldest bill
            first.
          </p>
          {visibleNodes.map((node) => (
            <ServiceNodeCard
              key={node.service.id}
              node={node}
              isOwner={isOwner}
              fromEarlierMonth={!isAll && monthKey(node.service.date) < month}
            />
          ))}
          <ExtraPaymentsCard advance={tree.advance} unplacedPending={tree.unplacedPending} isOwner={isOwner} />
          {visibleNodes.length === 0 && tree.advance.length === 0 && tree.unplacedPending.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-base font-semibold">No services {isAll ? "yet" : `in ${formatMonth(month)}`}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Press &quot;Add service&quot; when this client takes SMS, WhatsApp, IVR or any other service.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>
                Everything that happened for this client, newest first — who added it, when the Owner approved it,
                and how much was left to pay after that.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClientTimeline events={timeline} isOwner={isOwner} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

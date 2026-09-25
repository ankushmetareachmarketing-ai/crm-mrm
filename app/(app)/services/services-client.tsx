"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CalendarRange, Clock, Hourglass, Layers, Plus, ReceiptText, Wallet } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { ApprovalBadge, TermsBadge, TestingBadge } from "@/components/money-badges"
import { ApprovalActions } from "@/components/approval-actions"
import { formatCurrency, formatDate } from "@/lib/format"
import {
  currentMonthKey,
  formatMonth,
  monthKey,
  isTestingService,
  unitFor,
  type ApprovalStatus,
  type GstType,
  type PaymentTerms,
} from "@/lib/billing"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ALL_MONTHS = "all"

export interface BookedService {
  id: string
  clientId: string
  company: string
  salesPerson: string | null
  service: string
  quantity: number
  rate: number
  base: number
  gstType: GstType
  gst: number
  total: number
  date: string
  paymentTerms: PaymentTerms
  dueDate: string | null
  /** Paid at the time of booking (GST-inclusive / ex-GST). */
  paidNow: number
  paidNowBase: number
  recordedBy: string | null
  approvalStatus: ApprovalStatus
  approvedBy: string | null
}

export function ServicesClient({ services, isOwner }: { services: BookedService[]; isOwner: boolean }) {
  const [month, setMonth] = useState<string>(currentMonthKey())

  const monthOptions = useMemo(() => {
    const set = new Set(services.map((s) => monthKey(s.date)))
    set.add(currentMonthKey())
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [services])

  const visible = useMemo(
    () => (month === ALL_MONTHS ? services : services.filter((s) => monthKey(s.date) === month)),
    [services, month]
  )

  // Owner sees GST-inclusive money; Sales sees everything without GST.
  const amountOf = (s: BookedService) => (isOwner ? s.total : s.base)
  const paidOf = (s: BookedService) => (isOwner ? s.paidNow : s.paidNowBase)
  // Only Owner-approved services count; pending ones are shown separately.
  const active = visible.filter((s) => s.approvalStatus === "Approved")
  const pending = visible.filter((s) => s.approvalStatus === "Pending")
  const billed = active.reduce((sum, s) => sum + amountOf(s), 0)
  const paidAtBooking = active.reduce((sum, s) => sum + paidOf(s), 0)
  const onCredit = billed - paidAtBooking
  const periodLabel = month === ALL_MONTHS ? "all time" : formatMonth(month)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Services"
        description={
          isOwner
            ? "Every service booked for a client, with the payment terms agreed at booking."
            : "Services you have booked for your clients. All amounts are without GST."
        }
        actions={
          <>
            <Select value={month} onValueChange={(v) => setMonth(v ?? currentMonthKey())}>
              <SelectTrigger className="h-10 w-48 cursor-pointer text-base">
                <CalendarRange className="size-4 text-muted-foreground" />
                <SelectValue>{(v: string) => (v === ALL_MONTHS ? "All time" : formatMonth(v))}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_MONTHS}>All time</SelectItem>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMonth(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="h-10 cursor-pointer" nativeButton={false} render={<Link href="/services/new" />}>
              <Plus /> New service
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Active services" value={String(active.length)} icon={Layers} hint={`Approved · ${periodLabel}`} />
        <StatCard
          label="Waiting for Owner"
          value={String(pending.length)}
          icon={Hourglass}
          hint={pending.length > 0 ? formatCurrency(pending.reduce((sum, s) => sum + amountOf(s), 0)) : "Nothing pending"}
        />
        <StatCard
          label="Total bill"
          value={formatCurrency(billed)}
          icon={ReceiptText}
          hint={isOwner ? "Including GST" : "Without GST"}
        />
        <StatCard label="Paid while taking service" value={formatCurrency(paidAtBooking)} icon={Wallet} hint="Paid on the same day" />
        <StatCard label="To be paid later" value={formatCurrency(onCredit)} icon={Clock} hint="Given on credit" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All services</CardTitle>
          <CardDescription>
            Click a client name to see every payment made for their services and what is still to pay.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Quantity × rate</TableHead>
                {isOwner ? (
                  <>
                    <TableHead className="text-right">Without GST</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </>
                ) : (
                  <TableHead className="text-right">Amount</TableHead>
                )}
                <TableHead>Payment plan</TableHead>
                <TableHead className="text-right">Paid same day</TableHead>
                <TableHead>Rest to pay by</TableHead>
                <TableHead>{isOwner ? "Sales person" : "Booked by"}</TableHead>
                <TableHead>Status</TableHead>
                {isOwner && pending.length > 0 ? <TableHead className="text-right">Action</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((s) => (
                <TableRow key={s.id} className={cn(s.approvalStatus !== "Approved" && "bg-muted/30")}>
                  <TableCell className="text-sm whitespace-nowrap">{formatDate(s.date)}</TableCell>
                  <TableCell>
                    <Link href={`/sales-details/${s.clientId}`} className="text-sm font-medium hover:underline">
                      {s.company}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {s.service}
                      {isTestingService(s.service) ? <TestingBadge free={s.total === 0} /> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                    {s.quantity.toLocaleString("en-IN")} {unitFor(s.service).plural} × ₹{s.rate}
                  </TableCell>
                  {isOwner ? (
                    <>
                      <TableCell className="text-right text-sm">{formatCurrency(s.base)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {s.gst ? formatCurrency(s.gst) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(s.total)}</TableCell>
                    </>
                  ) : (
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(s.base)}</TableCell>
                  )}
                  <TableCell>
                    {isTestingService(s.service) && s.total === 0 ? (
                      <span className="text-xs text-muted-foreground">Nothing to pay</span>
                    ) : (
                      <TermsBadge terms={s.paymentTerms} />
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-emerald-700">
                    {paidOf(s) > 0 ? formatCurrency(paidOf(s)) : "—"}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{s.dueDate ? formatDate(s.dueDate) : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(isOwner ? s.salesPerson : s.recordedBy) ?? "—"}
                  </TableCell>
                  <TableCell>
                    <ApprovalBadge status={s.approvalStatus} kind="service" />
                    {s.approvalStatus !== "Pending" && s.approvedBy ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">by {s.approvedBy}</p>
                    ) : null}
                  </TableCell>
                  {isOwner && pending.length > 0 ? (
                    <TableCell className="text-right">
                      {s.approvalStatus === "Pending" ? <ApprovalActions kind="service" id={s.id} /> : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isOwner ? 13 : 10} className="py-10 text-center text-sm text-muted-foreground">
                    No services booked in {periodLabel}.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

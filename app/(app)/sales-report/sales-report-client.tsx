"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Download, IndianRupee, Receipt, Users2, TrendingUp } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency, formatDate } from "@/lib/format"
import { downloadCsv } from "@/lib/export-csv"
import type { Payment } from "@/lib/types"
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

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7)
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7)
}

function formatMonth(key: string) {
  const date = new Date(`${key}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return key
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(date)
}

function isSale(p: Payment) {
  return p.status === "Received" && p.approvalStatus === "Approved"
}

export function SalesReportClient({ payments, canSeeAll }: { payments: Payment[]; canSeeAll: boolean }) {
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey())

  const monthOptions = useMemo(() => {
    const set = new Set(payments.map((p) => monthKey(p.paymentDate)))
    set.add(currentMonthKey())
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [payments])

  const filtered = useMemo(
    () => (selectedMonth === ALL_MONTHS ? payments : payments.filter((p) => monthKey(p.paymentDate) === selectedMonth)),
    [payments, selectedMonth]
  )

  const sales = useMemo(() => filtered.filter(isSale), [filtered])
  const totalCollected = sales.reduce((sum, p) => sum + p.amount, 0)
  const clientsBilled = new Set(sales.map((p) => p.clientId)).size
  const avgSale = sales.length > 0 ? totalCollected / sales.length : 0

  const monthlyTotals = useMemo(() => {
    const byMonth = new Map<string, { collected: number; sales: number; clients: Set<string>; logged: number }>()
    for (const p of payments) {
      const key = monthKey(p.paymentDate)
      const entry = byMonth.get(key) ?? { collected: 0, sales: 0, clients: new Set<string>(), logged: 0 }
      entry.logged += 1
      if (isSale(p)) {
        entry.collected += p.amount
        entry.sales += 1
        entry.clients.add(p.clientId)
      }
      byMonth.set(key, entry)
    }
    return Array.from(byMonth.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, v]) => ({
        key,
        collected: v.collected,
        sales: v.sales,
        clients: v.clients.size,
        logged: v.logged,
      }))
  }, [payments])

  function exportSelection() {
    downloadCsv(
      `sales-report-${selectedMonth === ALL_MONTHS ? "all" : selectedMonth}.csv`,
      filtered.map((p) => ({
        Month: monthKey(p.paymentDate),
        Client: p.clientCompany,
        Date: p.paymentDate,
        Method: p.method ?? "",
        Reference: p.reference ?? "",
        Amount: p.amount,
        Status: p.status,
        Approval: p.approvalStatus,
        ...(canSeeAll ? { "Recorded by": p.recordedBy ?? "" } : {}),
        "Approved by": p.approvedBy ?? "",
      }))
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sales Report"
        description={
          canSeeAll
            ? "Company-wide sales collections, month by month."
            : "Your sales collections, month by month — from approved payments."
        }
        actions={
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={(v) => setSelectedMonth(v ?? currentMonthKey())}>
              <SelectTrigger className="h-10 w-48 text-base">
                <SelectValue placeholder="Month">
                  {(value: string) => (value === ALL_MONTHS ? "All time" : formatMonth(value))}
                </SelectValue>
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
            <Button size="sm" variant="outline" onClick={exportSelection} disabled={filtered.length === 0}>
              <Download /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={selectedMonth === ALL_MONTHS ? "Collected (all time)" : `Collected — ${formatMonth(selectedMonth)}`}
          value={formatCurrency(totalCollected)}
          icon={IndianRupee}
        />
        <StatCard label="Sales" value={String(sales.length)} icon={Receipt} hint="Approved & received" />
        <StatCard label="Clients billed" value={String(clientsBilled)} icon={Users2} />
        <StatCard label="Avg. sale value" value={formatCurrency(avgSale)} icon={TrendingUp} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Monthly totals</CardTitle>
            <CardDescription>Every month you have a record for.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyTotals.map((m) => (
                  <TableRow
                    key={m.key}
                    className="cursor-pointer"
                    onClick={() => setSelectedMonth(m.key)}
                    data-state={m.key === selectedMonth ? "selected" : undefined}
                  >
                    <TableCell className="font-medium">{formatMonth(m.key)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(m.collected)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{m.sales}</TableCell>
                  </TableRow>
                ))}
                {monthlyTotals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                      No sales recorded yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedMonth === ALL_MONTHS ? "All transactions" : `Transactions — ${formatMonth(selectedMonth)}`}
            </CardTitle>
            <CardDescription>Every payment recorded for this period, whatever its status.</CardDescription>
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
                  {canSeeAll ? <TableHead>Sales person</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
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
                    {canSeeAll ? (
                      <TableCell className="text-sm text-muted-foreground">{p.recordedBy ?? "—"}</TableCell>
                    ) : null}
                  </TableRow>
                ))}
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canSeeAll ? 7 : 6} className="py-8 text-center text-sm text-muted-foreground">
                      No payments recorded for this period.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

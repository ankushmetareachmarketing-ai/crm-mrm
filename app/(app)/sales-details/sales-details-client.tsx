"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, Clock, IndianRupee, ReceiptText, Wallet } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { formatCurrency } from "@/lib/format"
import { ApprovalBadge, PaidStateBadge } from "@/components/money-badges"
import type { ClientLedgerSummary } from "@/lib/billing"
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
import { cn } from "@/lib/utils"

const ALL = "all"
const UNASSIGNED = "unassigned"

interface Totals {
  billed: number
  received: number
  due: number
  pending: number
}

/** Owner sees GST-inclusive money; Sales sees everything ex-GST. */
function pick(s: ClientLedgerSummary, isOwner: boolean): Totals {
  return isOwner
    ? {
        billed: s.billedTotal,
        received: s.receivedTotal,
        due: s.dueTotal,
        pending: s.pendingApprovalTotal + s.pendingServicesTotal,
      }
    : {
        billed: s.billedBase,
        received: s.receivedBase,
        due: s.dueBase,
        pending: s.pendingApprovalBase + s.pendingServicesBase,
      }
}

function sum(rows: Totals[]): Totals {
  return rows.reduce(
    (acc, r) => ({
      billed: acc.billed + r.billed,
      received: acc.received + r.received,
      due: acc.due + r.due,
      pending: acc.pending + r.pending,
    }),
    { billed: 0, received: 0, due: 0, pending: 0 }
  )
}

function DueAmount({ value }: { value: number }) {
  if (value < 0) {
    return <span className="font-semibold text-sky-700">{formatCurrency(-value)} advance</span>
  }
  return (
    <span className={cn("font-semibold", value > 0 ? "text-destructive" : "text-muted-foreground")}>
      {formatCurrency(value)}
    </span>
  )
}

export function SalesDetailsClient({ summaries, isOwner }: { summaries: ClientLedgerSummary[]; isOwner: boolean }) {
  const router = useRouter()
  const [salesPerson, setSalesPerson] = useState<string>(ALL)

  const team = useMemo(() => {
    const byPerson = new Map<string, { key: string; name: string; clients: number; totals: Totals[] }>()
    for (const s of summaries) {
      const key = s.ownerEmployeeId ?? UNASSIGNED
      const entry = byPerson.get(key) ?? { key, name: s.ownerName ?? "Unassigned", clients: 0, totals: [] }
      entry.clients += 1
      entry.totals.push(pick(s, isOwner))
      byPerson.set(key, entry)
    }
    return Array.from(byPerson.values())
      .map((p) => ({ key: p.key, name: p.name, clients: p.clients, ...sum(p.totals) }))
      .sort((a, b) => b.due - a.due)
  }, [summaries, isOwner])

  const visible = useMemo(
    () =>
      salesPerson === ALL
        ? summaries
        : summaries.filter((s) => (s.ownerEmployeeId ?? UNASSIGNED) === salesPerson),
    [summaries, salesPerson]
  )
  const totals = sum(visible.map((s) => pick(s, isOwner)))
  const gstNote = isOwner ? "Including GST" : "Without GST"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sales Details"
        description={
          isOwner
            ? "Every client's billed services, payments received and balance due, by sales person."
            : "Your clients' billed services, payments received and balance due. All amounts are without GST."
        }
        actions={
          isOwner ? (
            <Select value={salesPerson} onValueChange={(v) => setSalesPerson(v ?? ALL)}>
              <SelectTrigger className="h-10 w-56 cursor-pointer text-base">
                <SelectValue placeholder="Sales person">
                  {(v: string) => (v === ALL ? "All sales people" : team.find((t) => t.key === v)?.name ?? v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All sales people</SelectItem>
                {team.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total bill" value={formatCurrency(totals.billed)} icon={ReceiptText} hint={gstNote} />
        <StatCard label="Paid" value={formatCurrency(totals.received)} icon={Wallet} hint="Approved payments" />
        <StatCard
          label="Still to pay"
          value={formatCurrency(Math.max(totals.due, 0))}
          icon={IndianRupee}
          hint={`${visible.filter((s) => pick(s, isOwner).due > 0).length} clients yet to pay`}
        />
        <StatCard
          label="Waiting for Owner"
          value={formatCurrency(totals.pending)}
          icon={Clock}
          hint="Not counted until the Owner approves"
        />
      </div>

      {isOwner && team.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sales team</CardTitle>
            <CardDescription>Click a sales person to see only their clients.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sales person</TableHead>
                  <TableHead className="text-right">Clients</TableHead>
                  <TableHead className="text-right">Total bill</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Still to pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((t) => (
                  <TableRow
                    key={t.key}
                    className={cn("cursor-pointer", salesPerson === t.key && "bg-accent/60")}
                    onClick={() => setSalesPerson(salesPerson === t.key ? ALL : t.key)}
                  >
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-right">{t.clients}</TableCell>
                    <TableCell className="text-right">{formatCurrency(t.billed)}</TableCell>
                    <TableCell className="text-right text-emerald-700">{formatCurrency(t.received)}</TableCell>
                    <TableCell className="text-right">
                      <DueAmount value={t.due} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
          <CardDescription>Click a client to see each service, the payments made for it, and what is still to pay.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                {isOwner ? <TableHead>Sales person</TableHead> : null}
                <TableHead className="text-right">Total bill</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Still to pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((s) => {
                const t = pick(s, isOwner)
                return (
                  <TableRow
                    key={s.clientId}
                    className="cursor-pointer"
                    onClick={() => router.push(`/sales-details/${s.clientId}`)}
                  >
                    <TableCell>
                      <Link
                        href={`/sales-details/${s.clientId}`}
                        className="font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {s.company}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {s.clientId} · {s.status}
                        {t.pending > 0 ? ` · ${formatCurrency(t.pending)} waiting for Owner` : ""}
                      </p>
                    </TableCell>
                    {isOwner ? (
                      <TableCell className="text-sm text-muted-foreground">{s.ownerName ?? "Unassigned"}</TableCell>
                    ) : null}
                    <TableCell className="text-right">{formatCurrency(t.billed)}</TableCell>
                    <TableCell className="text-right text-emerald-700">{formatCurrency(t.received)}</TableCell>
                    <TableCell className="text-right">
                      <DueAmount value={t.due} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {t.billed > 0 ? (
                          <PaidStateBadge
                            state={t.due <= 0.005 ? "Fully paid" : t.received > 0 ? "Partly paid" : "Not paid"}
                          />
                        ) : null}
                        {t.pending > 0 ? <ApprovalBadge status="Pending" kind="service" /> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                )
              })}
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isOwner ? 7 : 6} className="py-8 text-center text-sm text-muted-foreground">
                    No clients yet.
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

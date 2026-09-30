"use client"

import { useMemo, useState } from "react"
import { SearchField } from "@/components/search-field"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency, formatDate } from "@/lib/format"
import type { Payment } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function ClientPaymentsPanel({ payments }: { payments: Payment[] }) {
  const [query, setQuery] = useState("")
  const visiblePayments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return payments
    return payments.filter((payment) =>
      [payment.id, payment.reference, payment.method, payment.accountName, payment.accountHolder, payment.status, payment.approvalStatus]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    )
  }, [payments, query])

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <SearchField
          className="w-full sm:max-w-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search payments by method, reference, account…"
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Recorded by</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiblePayments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="text-sm">{formatDate(payment.paymentDate)}</TableCell>
                <TableCell className="font-mono text-xs">{payment.reference ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{payment.method ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  {payment.accountName || payment.accountHolder
                    ? [payment.accountName, payment.accountHolder].filter(Boolean).join(" · ")
                    : "—"}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">{formatCurrency(payment.amount)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{payment.recordedBy ?? "—"}</TableCell>
                <TableCell><StatusBadge status={payment.approvalStatus} /></TableCell>
                <TableCell><StatusBadge status={payment.status} /></TableCell>
              </TableRow>
            ))}
            {visiblePayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  {query ? "No payments match your search." : "No payments recorded for this client yet."}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          A pending payment does not change the confirmed due balance until the Owner approves it.
        </p>
      </CardContent>
    </Card>
  )
}
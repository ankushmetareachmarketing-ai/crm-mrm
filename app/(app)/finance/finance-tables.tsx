"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { SearchField } from "@/components/search-field"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency, formatDate } from "@/lib/format"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface FinanceClientRow {
  id: string
  company: string
  balance: number
  lastReceiptDate: string | null
}

interface PendingReceiptRow {
  id: string
  clientId: string
  company: string
  amount: number
}

export function FinanceTables({
  clients,
  pendingReceipts,
}: {
  clients: FinanceClientRow[]
  pendingReceipts: PendingReceiptRow[]
}) {
  const [clientQuery, setClientQuery] = useState("")
  const [receiptQuery, setReceiptQuery] = useState("")

  const visibleClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase()
    if (!query) return clients
    return clients.filter((client) =>
      [client.company, client.id].some((value) => value.toLowerCase().includes(query))
    )
  }, [clients, clientQuery])

  const visibleReceipts = useMemo(() => {
    const query = receiptQuery.trim().toLowerCase()
    if (!query) return pendingReceipts
    return pendingReceipts.filter((receipt) =>
      [receipt.company, receipt.clientId, receipt.id].some((value) => value.toLowerCase().includes(query))
    )
  }, [pendingReceipts, receiptQuery])

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Client due / advance aging</CardTitle>
          <CardDescription>Due = max(balance, 0). Advance = max(-balance, 0).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SearchField
            className="w-full sm:max-w-sm"
            value={clientQuery}
            onChange={(e) => setClientQuery(e.target.value)}
            placeholder="Search clients by company or ID…"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="text-right">Advance</TableHead>
                <TableHead>Last receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link href={`/crm/clients/${client.id}`} className="font-medium hover:underline">
                      {client.company}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    {client.balance > 0 ? formatCurrency(client.balance) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-emerald-700">
                    {client.balance < 0 ? formatCurrency(-client.balance) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(client.lastReceiptDate)}</TableCell>
                </TableRow>
              ))}
              {visibleClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    No clients match your search.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending payment submissions</CardTitle>
          <CardDescription>Does not change confirmed due until accepted.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SearchField
            className="w-full"
            value={receiptQuery}
            onChange={(e) => setReceiptQuery(e.target.value)}
            placeholder="Search pending receipts…"
          />
          {visibleReceipts.map((receipt) => (
            <Link key={receipt.id} href={`/crm/clients/${receipt.clientId}`} className="block rounded-lg border p-3 hover:border-primary">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{receipt.company}</span>
                <StatusBadge status="Pending" />
              </div>
              <p className="mt-1 text-sm font-medium">{formatCurrency(receipt.amount)}</p>
            </Link>
          ))}
          {visibleReceipts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {receiptQuery ? "No submissions match your search." : "No submissions awaiting acceptance."}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
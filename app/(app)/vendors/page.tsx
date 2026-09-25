"use client"

import { Lock } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency, formatDate } from "@/lib/format"
import { vendors, vendorRates } from "@/lib/mock-data"
import { useRole } from "@/components/role-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function VendorsPage() {
  const { role } = useRole()
  const canSeeRates = role === "Owner"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vendor Management"
        description="Employees see vendor and panel labels — buying rates remain owner-only."
      />

      <Card>
        <CardHeader>
          <CardTitle>Vendors</CardTitle>
          <CardDescription>Service and panel mappings, active status and balances.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Panels</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Last transaction</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {v.services.map((s) => (
                        <Badge key={s} variant="outline" className="font-normal">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {v.panels.length > 0 ? v.panels.join(", ") : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={v.activeStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{formatCurrency(v.balance)}</div>
                    <div className="text-xs text-muted-foreground">{v.balanceType}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(v.lastTransaction)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Buying rates</CardTitle>
          <CardDescription>
            Rate versions by vendor, service and panel. A blank rate shows Incomplete, never zero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canSeeRates ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Panel</TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Effective from</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorRates.map((r) => {
                  const vendor = vendors.find((v) => v.id === r.vendorId)
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{vendor?.name}</TableCell>
                      <TableCell>{r.service}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.panel}</TableCell>
                      <TableCell>{r.component}</TableCell>
                      <TableCell className="text-right">
                        {r.rate !== null ? `${r.currency} ${r.rate.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(r.effectiveFrom)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
              <Lock className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">Buying rates are owner-only</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Switch to &ldquo;View as Owner&rdquo; in the header to view confidential rate cards and margins.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

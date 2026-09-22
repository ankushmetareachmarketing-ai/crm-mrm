import {
  Wallet,
  ReceiptText,
  TrendingUp,
  Truck,
  Megaphone,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { CollectionsTrendChart, ServiceRevenueChart } from "@/components/dashboard-charts"
import { formatCurrency, formatDate } from "@/lib/format"
import { approvalInbox, overdueTasks, vendors, campaigns } from "@/lib/mock-data"

export function OwnerDashboard() {
  const verifiedCollections = 186400
  const outstandingDues = 158500
  const clientAdvances = 8600
  const lowBalanceVendors = vendors.filter((v) => v.balanceType === "Advance" && v.balance < 10000)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Owner Dashboard"
        description="Approval inbox, collections, margins and operational health at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Verified Collections (MTD)"
          value={formatCurrency(verifiedCollections)}
          icon={Wallet}
          trend="+12.4% vs last month"
          trendTone="up"
        />
        <StatCard
          label="Outstanding Dues"
          value={formatCurrency(outstandingDues)}
          icon={ReceiptText}
          hint="Across 6 active clients"
        />
        <StatCard
          label="Client Advances Held"
          value={formatCurrency(clientAdvances)}
          icon={TrendingUp}
          hint="Unallocated credit balance"
        />
        <StatCard
          label="Provisional Gross Margin"
          value="31.2%"
          icon={Megaphone}
          hint="Incomplete costing on 2 campaigns"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <CollectionsTrendChart />
        <ServiceRevenueChart />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Approval inbox</CardTitle>
            <CardDescription>
              Pending payments and campaigns awaiting Owner acceptance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Submitted by</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvalInbox.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <StatusBadge status={item.type} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.reference}</TableCell>
                    <TableCell>{item.client}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">{item.submittedBy}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline">Return</Button>
                        <Button size="sm">Accept</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overdue &amp; needs attention</CardTitle>
            <CardDescription>Follow-ups, cost reports and unverified rentals.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {overdueTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Clock className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{task.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{task.context}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {task.owner} · due {formatDate(task.dueDate)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent campaign activity</CardTitle>
            <CardDescription>Latest execution status across services.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Agreed amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.slice(0, 5).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.id}</TableCell>
                    <TableCell>{c.client}</TableCell>
                    <TableCell>{c.service}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(c.agreedAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendor balance alerts</CardTitle>
            <CardDescription>Advance balances running low.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {lowBalanceVendors.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Avatar className="size-9">
                  <AvatarFallback>
                    <Truck className="size-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.services.join(", ")}
                  </p>
                </div>
                <span className="text-sm font-medium text-amber-700">
                  {formatCurrency(v.balance)}
                </span>
              </div>
            ))}
            {lowBalanceVendors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No vendor balances need attention.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

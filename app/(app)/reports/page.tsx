import {
  Wallet,
  ReceiptText,
  LineChart,
  Truck,
  Megaphone,
  Users,
  Banknote,
  History,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { auditLog } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const reportCards = [
  { title: "Verified collections", description: "By account and payment mode.", icon: Wallet },
  { title: "Customer due aging", description: "Due and advance balances by client.", icon: ReceiptText },
  { title: "Service revenue & cost", description: "Revenue, cost, commission and contribution.", icon: LineChart },
  { title: "Vendor balances", description: "Supplier balances and dues.", icon: Truck },
  { title: "Campaign results", description: "Execution metrics by service.", icon: Megaphone },
  { title: "Employee contribution", description: "Contribution after commission and overhead.", icon: Users },
  { title: "Payroll summary", description: "Payable salary and exceptions.", icon: Banknote },
  { title: "Audit history", description: "Immutable actor-level audit trail.", icon: History },
]

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports & Audit"
        description="Exports apply the same role-based restrictions as the UI and API."
      />

      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library">Report library</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="library">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reportCards.map((r) => (
              <Card key={r.title}>
                <CardHeader>
                  <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <r.icon className="size-5" />
                  </div>
                  <CardTitle>{r.title}</CardTitle>
                  <CardDescription>{r.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm">
                    View report
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Recent audit events</CardTitle>
              <CardDescription>
                Actor identity remains correct even after employee rename or deactivation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="text-right">Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-mono text-xs">{event.id}</TableCell>
                      <TableCell>{event.actor}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{event.action}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{event.entity}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{event.timestamp}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

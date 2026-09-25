import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "@/components/icons"
import { StatusBadge } from "@/components/status-badge"
import { StatCard } from "@/components/stat-card"
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/format"
import { pool } from "@/lib/db"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import type { Client, ClientContact, ClientNote, ActivityEntry, Payment } from "@/lib/types"
import { Wallet, ReceiptText, Building2, CalendarClock, CalendarCheck } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { ContactsPanel } from "./contacts-panel"
import { NotesPanel } from "./notes-panel"

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const currentEmployee = await getCurrentEmployee()

  const { rows: clientRows } = await pool.query<{
    id: string
    company: string
    industry: string
    owner_employee_id: string | null
    owner_name: string | null
    status: Client["status"]
    balance: string
    last_receipt_date: string | null
    since: string
    renewal_date: string | null
    website: string | null
    logo_url: string | null
    gstin: string | null
    company_size: string | null
    address_line1: string | null
    address_line2: string | null
    city: string | null
    state: string | null
    pincode: string | null
    country: string
    description: string | null
  }>(
    `select c.id, c.company, c.industry, c.owner_employee_id, e.name as owner_name, c.status,
            c.balance::text, c.last_receipt_date::text, c.since::text, c.renewal_date::text,
            c.website, c.logo_url, c.gstin, c.company_size, c.address_line1, c.address_line2,
            c.city, c.state, c.pincode, c.country, c.description
     from public.clients c
     left join public.employees e on e.id = c.owner_employee_id
     where c.id = $1`,
    [id]
  )
  const clientRow = clientRows[0]
  if (!clientRow) notFound()

  // A non-owned client 404s the same way a missing one does — no signal
  // that leaks whether the record exists to someone who can't see it.
  if (currentEmployee.role !== "Owner" && clientRow.owner_employee_id !== currentEmployee.id) {
    notFound()
  }

  const client: Client & { balance: number } = {
    id: clientRow.id,
    company: clientRow.company,
    industry: clientRow.industry,
    owner: clientRow.owner_name ?? "—",
    ownerEmployeeId: clientRow.owner_employee_id,
    status: clientRow.status,
    contacts: 0,
    balance: Number(clientRow.balance),
    lastReceiptDate: clientRow.last_receipt_date,
    since: clientRow.since,
    renewalDate: clientRow.renewal_date,
    website: clientRow.website,
    logoUrl: clientRow.logo_url,
    gstin: clientRow.gstin,
    companySize: clientRow.company_size,
    addressLine1: clientRow.address_line1,
    addressLine2: clientRow.address_line2,
    city: clientRow.city,
    state: clientRow.state,
    pincode: clientRow.pincode,
    country: clientRow.country,
    description: clientRow.description,
  }

  const addressParts = [
    client.addressLine1,
    client.addressLine2,
    client.city,
    client.state,
    client.pincode,
    client.country,
  ].filter(Boolean)

  const [contactsResult, notesResult, activityResult, paymentsResult] = await Promise.all([
    pool.query<{ id: string; name: string; designation: string | null; phone: string | null; email: string | null }>(
      `select id, name, designation, phone, email from public.client_contacts where client_id = $1 order by created_at`,
      [id]
    ),
    pool.query<{ id: string; body: string; author_name: string | null; created_at: string }>(
      `select n.id, n.body, e.name as author_name, n.created_at::text
       from public.notes n
       left join public.employees e on e.id = n.author_employee_id
       where n.entity_type = 'client' and n.entity_id = $1
       order by n.created_at desc`,
      [id]
    ),
    pool.query<{ id: string; action: string; detail: string | null; actor_name: string | null; created_at: string }>(
      `select a.id, a.action, a.detail, e.name as actor_name, a.created_at::text
       from public.activity_log a
       left join public.employees e on e.id = a.actor_employee_id
       where a.entity_type = 'client' and a.entity_id = $1
       order by a.created_at desc`,
      [id]
    ),
    pool.query<{
      id: string
      amount: string
      payment_date: string
      method: string | null
      reference: string | null
      status: Payment["status"]
      notes: string | null
      recorded_by_name: string | null
      created_at: string
      approval_status: Payment["approvalStatus"]
      approved_by_name: string | null
      approved_at: string | null
    }>(
      `select p.id, p.amount::text, p.payment_date::text, p.method, p.reference, p.status, p.notes,
              e.name as recorded_by_name, p.created_at::text,
              p.approval_status, a.name as approved_by_name, p.approved_at::text
       from public.payments p
       left join public.employees e on e.id = p.recorded_by_employee_id
       left join public.employees a on a.id = p.approved_by_employee_id
       where p.client_id = $1
       order by p.payment_date desc, p.created_at desc`,
      [id]
    ),
  ])

  const contacts: ClientContact[] = contactsResult.rows
  const notes: ClientNote[] = notesResult.rows.map((n) => ({
    id: n.id,
    body: n.body,
    author: n.author_name,
    createdAt: n.created_at,
  }))
  const activity: ActivityEntry[] = activityResult.rows.map((a) => ({
    id: a.id,
    action: a.action,
    detail: a.detail,
    actor: a.actor_name,
    createdAt: a.created_at,
  }))

  const payments: Payment[] = paymentsResult.rows.map((p) => ({
    id: p.id,
    clientId: client.id,
    clientCompany: client.company,
    amount: Number(p.amount),
    paymentDate: p.payment_date,
    method: p.method,
    reference: p.reference,
    status: p.status,
    notes: p.notes,
    recordedBy: p.recorded_by_name,
    createdAt: p.created_at,
    approvalStatus: p.approval_status,
    approvedBy: p.approved_by_name,
    approvedAt: p.approved_at,
  }))
  const totalReceived = payments
    .filter((p) => p.approvalStatus === "Approved")
    .reduce((sum, p) => sum + p.amount, 0)
  const due = Math.max(client.balance, 0)
  const advance = Math.max(-client.balance, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          nativeButton={false}
          render={<Link href="/crm/clients" />}
        >
          <ArrowLeft /> Back to clients
        </Button>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {client.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={client.logoUrl} alt="" className="size-12 rounded-md border object-cover" />
            ) : null}
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{client.company}</h2>
              <p className="text-sm text-muted-foreground">
                {client.id} · {client.industry} · Owned by {client.owner}
              </p>
              <p className="text-xs text-muted-foreground">
                {[
                  client.website,
                  client.gstin ? `GSTIN ${client.gstin}` : null,
                  client.companySize ? `${client.companySize} employees` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={client.status} />
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              nativeButton={false}
              render={<Link href={`/sales-details/${client.id}`} />}
            >
              Services &amp; payments
            </Button>
          </div>
        </div>
        {addressParts.length > 0 || client.description ? (
          <div className="text-sm text-muted-foreground">
            {addressParts.length > 0 ? <p>{addressParts.join(", ")}</p> : null}
            {client.description ? <p className="mt-1">{client.description}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Amount due" value={formatCurrency(due)} icon={ReceiptText} hint="Positive balance" />
        <StatCard label="Advance held" value={formatCurrency(advance)} icon={Wallet} hint="Unallocated credit" />
        <StatCard label="Total received" value={formatCurrency(totalReceived)} icon={CalendarCheck} hint="Approved payments" />
        <StatCard label="Client since" value={formatDate(client.since)} icon={Building2} />
        <StatCard label="Renewal due" value={formatDate(client.renewalDate)} icon={CalendarClock} />
      </div>

      <Tabs defaultValue="payments">
        <TabsList className="h-11 flex-wrap p-1">
          <TabsTrigger value="payments" className="px-3 py-1.5">Payments</TabsTrigger>
          <TabsTrigger value="contacts" className="px-3 py-1.5">Contacts</TabsTrigger>
          <TabsTrigger value="notes" className="px-3 py-1.5">Notes</TabsTrigger>
          <TabsTrigger value="activity" className="px-3 py-1.5">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Recorded by</TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{formatDate(p.paymentDate)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.reference ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.method ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(p.amount)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.recordedBy ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.approvalStatus} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        No payments recorded for this client yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">
                A pending payment does not change the confirmed due balance until the Owner approves it.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <ContactsPanel clientId={client.id} initialContacts={contacts} />
        </TabsContent>

        <TabsContent value="notes">
          <NotesPanel clientId={client.id} initialNotes={notes} />
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardContent>
              <div className="flex flex-col gap-3">
                {activity.map((a) => (
                  <div key={a.id} className="flex gap-3 border-b pb-3 last:border-0">
                    <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                    <div>
                      <p className="text-sm font-medium">
                        {a.action}
                        {a.actor ? <span className="font-normal text-muted-foreground"> · {a.actor}</span> : null}
                      </p>
                      {a.detail ? <p className="text-sm text-muted-foreground">{a.detail}</p> : null}
                      <p className="text-xs text-muted-foreground">{formatRelativeTime(a.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {activity.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

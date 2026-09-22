import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import { StatCard } from "@/components/stat-card"
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/format"
import { ledgerEntries, campaigns, meetings } from "@/lib/mock-data"
import { pool } from "@/lib/db"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import type { Client, ClientContact, ClientNote, ActivityEntry } from "@/lib/types"
import { Wallet, ReceiptText, Building2, CalendarClock } from "lucide-react"
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
            c.balance::text, c.last_receipt_date::text, c.since::text,
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

  const [contactsResult, notesResult, activityResult] = await Promise.all([
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

  const entries = ledgerEntries.filter((e) => e.clientId === client.id)
  const clientCampaigns = campaigns.filter((c) => c.client === client.company)
  const clientMeetings = meetings.filter((m) => m.client === client.company)
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
          <StatusBadge status={client.status} />
        </div>
        {addressParts.length > 0 || client.description ? (
          <div className="text-sm text-muted-foreground">
            {addressParts.length > 0 ? <p>{addressParts.join(", ")}</p> : null}
            {client.description ? <p className="mt-1">{client.description}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Amount due" value={formatCurrency(due)} icon={ReceiptText} hint="Positive balance" />
        <StatCard label="Advance held" value={formatCurrency(advance)} icon={Wallet} hint="Unallocated credit" />
        <StatCard label="Client since" value={formatDate(client.since)} icon={Building2} />
        <StatCard label="Last receipt" value={formatDate(client.lastReceiptDate)} icon={CalendarClock} />
      </div>

      <Tabs defaultValue="ledger">
        <TabsList className="h-11 flex-wrap p-1">
          <TabsTrigger value="ledger" className="px-3 py-1.5">Ledger</TabsTrigger>
          <TabsTrigger value="campaigns" className="px-3 py-1.5">Campaigns</TabsTrigger>
          <TabsTrigger value="meetings" className="px-3 py-1.5">Meetings</TabsTrigger>
          <TabsTrigger value="contacts" className="px-3 py-1.5">Contacts</TabsTrigger>
          <TabsTrigger value="notes" className="px-3 py-1.5">Notes</TabsTrigger>
          <TabsTrigger value="activity" className="px-3 py-1.5">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm">{formatDate(e.date)}</TableCell>
                      <TableCell className="text-sm">{e.type}</TableCell>
                      <TableCell className="font-mono text-xs">{e.reference}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.description}</TableCell>
                      <TableCell className="text-right text-sm">
                        {e.debit ? formatCurrency(e.debit) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {e.credit ? formatCurrency(e.credit) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(e.runningBalance)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={e.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        No ledger activity recorded for this client yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">
                A pending receipt does not change the confirmed due balance until Owner acceptance posts it.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Agreed amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientCampaigns.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.id}</TableCell>
                      <TableCell>{c.service}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.vendor}</TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(c.agreedAmount)}</TableCell>
                    </TableRow>
                  ))}
                  {clientCampaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No campaigns yet for this client.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meetings">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Planned</TableHead>
                    <TableHead>Responsible</TableHead>
                    <TableHead>Person met</TableHead>
                    <TableHead>Requirement</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientMeetings.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">{m.plannedAt}</TableCell>
                      <TableCell className="text-sm">{m.responsible}</TableCell>
                      <TableCell>
                        <div className="text-sm">{m.personMet}</div>
                        <div className="text-xs text-muted-foreground">{m.designation}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.requirement}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.outcome}</TableCell>
                      <TableCell>
                        <StatusBadge status={m.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {clientMeetings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        No meetings logged for this client.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
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

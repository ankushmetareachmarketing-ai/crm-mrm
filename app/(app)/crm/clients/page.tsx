import { pool } from "@/lib/db"
import type { Client } from "@/lib/types"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import { getActiveEmployeeOptions } from "@/lib/data/employees"
import { ClientsClient } from "./clients-client"

interface ClientRow {
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
  contacts_count: string
  total_received: string
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
}

export default async function ClientsPage() {
  const currentEmployee = await getCurrentEmployee()
  const isOwner = currentEmployee.role === "Owner"

  const [clientsResult, employees] = await Promise.all([
    pool.query<ClientRow>(
      `select c.id, c.company, c.industry, c.owner_employee_id, e.name as owner_name,
              c.status, c.balance::text, c.last_receipt_date::text, c.since::text, c.renewal_date::text,
              (select count(*) from public.client_contacts cc where cc.client_id = c.id)::text as contacts_count,
              (select coalesce(sum(p.amount), 0) from public.payments p
                where p.client_id = c.id and p.approval_status = 'Approved')::text as total_received,
              c.website, c.logo_url, c.gstin, c.company_size, c.address_line1, c.address_line2,
              c.city, c.state, c.pincode, c.country, c.description
       from public.clients c
       left join public.employees e on e.id = c.owner_employee_id
       ${isOwner ? "" : "where c.owner_employee_id = $1"}
       order by c.created_at desc`,
      isOwner ? [] : [currentEmployee.id]
    ),
    getActiveEmployeeOptions(),
  ])

  const clients: (Client & { totalReceived: number })[] = clientsResult.rows.map((c) => ({
    id: c.id,
    company: c.company,
    industry: c.industry,
    owner: c.owner_name ?? "—",
    ownerEmployeeId: c.owner_employee_id,
    status: c.status,
    contacts: Number(c.contacts_count),
    balance: Number(c.balance),
    lastReceiptDate: c.last_receipt_date,
    since: c.since,
    renewalDate: c.renewal_date,
    totalReceived: Number(c.total_received),
    website: c.website,
    logoUrl: c.logo_url,
    gstin: c.gstin,
    companySize: c.company_size,
    addressLine1: c.address_line1,
    addressLine2: c.address_line2,
    city: c.city,
    state: c.state,
    pincode: c.pincode,
    country: c.country,
    description: c.description,
  }))

  return (
    <ClientsClient
      initialClients={clients}
      employees={employees}
      currentEmployeeId={currentEmployee.id}
      isOwner={isOwner}
    />
  )
}

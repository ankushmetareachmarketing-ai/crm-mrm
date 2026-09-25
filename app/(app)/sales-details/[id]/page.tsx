import { notFound } from "next/navigation"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import { getClientLedgerEntries } from "@/lib/data/client-ledger"
import { pool } from "@/lib/db"
import { ClientStatementClient } from "./client-statement-client"

export default async function ClientStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const currentEmployee = await getCurrentEmployee()

  const { rows } = await pool.query<{
    id: string
    company: string
    status: string
    owner_employee_id: string | null
    owner_name: string | null
  }>(
    `select c.id, c.company, c.status, c.owner_employee_id, e.name as owner_name
     from public.clients c
     left join public.employees e on e.id = c.owner_employee_id
     where c.id = $1`,
    [id]
  )
  const client = rows[0]
  // Same rule as /crm/clients/[id]: someone else's client 404s like a missing one.
  if (!client || (currentEmployee.role !== "Owner" && client.owner_employee_id !== currentEmployee.id)) {
    notFound()
  }

  const entries = await getClientLedgerEntries(id)

  return (
    <ClientStatementClient
      client={{ id: client.id, company: client.company, status: client.status, ownerName: client.owner_name }}
      entries={entries}
      isOwner={currentEmployee.role === "Owner"}
      paymentsNeedApproval={currentEmployee.role !== "Owner"}
    />
  )
}

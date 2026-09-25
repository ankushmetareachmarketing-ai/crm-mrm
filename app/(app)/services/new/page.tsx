import { getCurrentEmployee } from "@/lib/auth/current-user"
import { getClientLedgerSummaries } from "@/lib/data/client-ledger"
import { NewServiceForm } from "./new-service-form"

export default async function NewServicePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const [currentEmployee, { client }] = await Promise.all([getCurrentEmployee(), searchParams])
  const isOwner = currentEmployee.role === "Owner"
  const summaries = await getClientLedgerSummaries(isOwner ? null : currentEmployee.id)

  const clients = summaries.map((s) => ({ id: s.clientId, company: s.company, dueTotal: s.dueTotal }))

  return (
    <NewServiceForm
      clients={clients}
      initialClientId={clients.some((c) => c.id === client) ? client! : ""}
      isOwner={isOwner}
      paymentsNeedApproval={currentEmployee.role !== "Owner"}
    />
  )
}

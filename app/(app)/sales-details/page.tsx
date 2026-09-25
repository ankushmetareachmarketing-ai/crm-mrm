import { getCurrentEmployee } from "@/lib/auth/current-user"
import { getClientLedgerSummaries } from "@/lib/data/client-ledger"
import { SalesDetailsClient } from "./sales-details-client"

export default async function SalesDetailsPage() {
  const currentEmployee = await getCurrentEmployee()
  const isOwner = currentEmployee.role === "Owner"

  const summaries = await getClientLedgerSummaries(isOwner ? null : currentEmployee.id)

  return <SalesDetailsClient summaries={summaries} isOwner={isOwner} />
}

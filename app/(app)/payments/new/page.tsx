import { pool } from "@/lib/db"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import { PaymentForm } from "./payment-form"

export default async function NewPaymentPage() {
  const currentEmployee = await getCurrentEmployee()
  const isOwner = currentEmployee.role === "Owner"

  const { rows: clients } = await pool.query<{ id: string; company: string; balance: string }>(
    `select id, company, balance::text
     from public.clients
     ${isOwner ? "" : "where owner_employee_id = $1"}
     order by company`,
    isOwner ? [] : [currentEmployee.id]
  )

  return (
    <PaymentForm
      clients={clients.map((c) => ({ id: c.id, company: c.company, balance: Number(c.balance) }))}
    />
  )
}

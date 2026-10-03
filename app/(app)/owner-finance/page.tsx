import { notFound } from "next/navigation"
import { getCurrentEmployee } from "@/lib/auth/current-user"
import {
  getExpenses,
  getIncomeBreakdown,
  getMonthlyFinance,
  getOutstandingNow,
  getSalaryCandidates,
} from "@/lib/data/finance"
import { officeDateKey } from "@/lib/hr/time"
import { FinanceClient } from "./finance-client"

export default async function OwnerFinancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const me = await getCurrentEmployee()
  if (me.role !== "Owner") notFound()

  const current = officeDateKey().slice(0, 7)
  const { month: requested } = await searchParams
  const month = requested && /^\d{4}-\d{2}$/.test(requested) && requested <= current ? requested : current

  // The last 12 months, newest first — the dropdown and the yearly table.
  const months: string[] = []
  const cursor = new Date(`${current}-01T00:00:00Z`)
  for (let i = 0; i < 12; i++) {
    months.push(cursor.toISOString().slice(0, 7))
    cursor.setUTCMonth(cursor.getUTCMonth() - 1)
  }
  if (!months.includes(month)) months.push(month)

  const [yearly, expenses, breakdown, salaries, outstanding] = await Promise.all([
    getMonthlyFinance(months),
    getExpenses(month),
    getIncomeBreakdown(month),
    getSalaryCandidates(month),
    getOutstandingNow(),
  ])

  return (
    <FinanceClient
      month={month}
      months={months}
      yearly={yearly}
      expenses={expenses}
      breakdown={breakdown}
      salaries={salaries}
      outstanding={outstanding}
    />
  )
}

// Owner finance — shared by server and browser.

export const EXPENSE_CATEGORIES = [
  "Salary",
  "Rent",
  "Vendor / SMS cost",
  "Electricity & Internet",
  "Marketing",
  "Software",
  "Travel",
  "Office",
  "Tax",
  "Other",
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const EXPENSE_METHODS = ["Bank Transfer", "UPI", "Cash", "Cheque", "Card", "Other"]

export interface ExpenseRow {
  id: string
  date: string
  category: ExpenseCategory
  description: string
  amount: number
  paidTo: string | null
  paymentMethod: string | null
  reference: string | null
  employeeId: string | null
  createdBy: string | null
}

export interface MonthFinance {
  month: string
  /** Approved payments received this month. */
  collectedTotal: number
  collectedGst: number
  collectedBase: number
  paymentsCount: number
  /** Approved services billed this month. */
  billedTotal: number
  billedGst: number
  billedBase: number
  expenses: number
  /** Income without GST minus expenses. */
  profit: number
}

export interface FinanceBreakdownRow {
  name: string
  total: number
  base: number
  count: number
}

export interface SalaryCandidate {
  employeeId: string
  name: string
  salary: number
  alreadyAdded: boolean
}

export function monthLabel(key: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(`${key}-01T00:00:00`))
}

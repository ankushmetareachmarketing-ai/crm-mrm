import "server-only"
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/finance"
import { isPositiveNumber, isValidDateString } from "@/lib/validate"

const text = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null)

/** Validates an expense from a request body. */
export function parseExpense(b: Record<string, unknown>) {
  if (!isValidDateString(b.date)) return { error: "Choose the expense date." }
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(String(b.category))) return { error: "Choose a category." }
  const description = text(b.description, 300)
  if (!description) return { error: "Write what the expense was for." }
  if (!isPositiveNumber(b.amount)) return { error: "Amount must be more than 0." }
  return {
    value: {
      date: b.date as string,
      category: b.category as ExpenseCategory,
      description,
      amount: Math.round(Number(b.amount) * 100) / 100,
      paidTo: text(b.paidTo, 200),
      paymentMethod: text(b.paymentMethod, 50),
      reference: text(b.reference, 100),
    },
  }
}

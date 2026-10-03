"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarRange, Download, Pencil, Plus, ReceiptText, Search, Trash2, Users, Wallet } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { Field, TextSelect } from "@/components/hr/form-bits"
import {
  EXPENSE_CATEGORIES,
  EXPENSE_METHODS,
  monthLabel,
  type ExpenseCategory,
  type ExpenseRow,
  type FinanceBreakdownRow,
  type MonthFinance,
  type SalaryCandidate,
} from "@/lib/finance"
import { downloadCsv } from "@/lib/export-csv"
import { formatCurrency, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ALL = "all"

/** One number in the money sum row. */
function SumBox({ label, value, hint, tone, strong }: { label: string; value: number; hint: string; tone?: string; strong?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5 rounded-2xl border bg-card px-4 py-3", strong && "border-2 border-primary/40 bg-primary/5")}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("text-2xl font-bold tracking-tight", tone)}>{formatCurrency(value)}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}

function Op({ symbol }: { symbol: string }) {
  return (
    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center self-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
      {symbol}
    </span>
  )
}

/** A ranked list with a single-measure bar per row. */
function BarList({ rows, empty, value }: { rows: FinanceBreakdownRow[]; empty: string; value: (r: FinanceBreakdownRow) => number }) {
  const max = Math.max(1, ...rows.map(value))
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.name} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{r.name}</span>
            <span className="font-semibold whitespace-nowrap">{formatCurrency(value(r))}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(value(r) / max) * 100}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">
            {r.count} {r.count === 1 ? "entry" : "entries"}
          </span>
        </div>
      ))}
    </div>
  )
}

type Draft = {
  id: string | null
  date: string
  category: ExpenseCategory
  description: string
  amount: string
  paidTo: string
  paymentMethod: string
  reference: string
}

export function FinanceClient({
  month,
  months,
  yearly,
  expenses,
  breakdown,
  salaries,
  outstanding,
}: {
  month: string
  months: string[]
  yearly: MonthFinance[]
  expenses: ExpenseRow[]
  breakdown: { byService: FinanceBreakdownRow[]; bySalesPerson: FinanceBreakdownRow[] }
  salaries: SalaryCandidate[]
  outstanding: number
}) {
  const router = useRouter()
  const m = yearly.find((y) => y.month === month)!
  const [draft, setDraft] = useState<Draft | null>(null)
  const [salaryOpen, setSalaryOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState(ALL)

  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  const defaultDate = today.startsWith(month) ? today : lastDay

  const byCategory = EXPENSE_CATEGORIES.map((c) => {
    const items = expenses.filter((e) => e.category === c)
    return { name: c, total: items.reduce((s, e) => s + e.amount, 0), base: 0, count: items.length }
  })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.total - a.total)

  const q = query.trim().toLowerCase()
  const visibleExpenses = expenses.filter(
    (e) =>
      (category === ALL || e.category === category) &&
      (!q || [e.description, e.paidTo, e.reference, e.category].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
  )
  const pendingSalaries = salaries.filter((s) => !s.alreadyAdded)

  async function call(url: string, method: string, body?: object) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Could not save.")
        return null
      }
      router.refresh()
      return data
    } finally {
      setBusy(false)
    }
  }

  async function saveDraft() {
    if (!draft) return
    const ok = await call(draft.id ? `/api/finance/expenses/${draft.id}` : "/api/finance/expenses", draft.id ? "PATCH" : "POST", draft)
    if (ok) setDraft(null)
  }

  function exportMonth() {
    downloadCsv(
      `expenses-${month}.csv`,
      expenses.map((e) => ({
        Date: e.date,
        Category: e.category,
        Description: e.description,
        Amount: e.amount,
        "Paid to": e.paidTo ?? "",
        Method: e.paymentMethod ?? "",
        Reference: e.reference ?? "",
      }))
    )
  }

  function exportYear() {
    downloadCsv(
      "finance-12-months.csv",
      yearly.map((y) => ({
        Month: monthLabel(y.month),
        "Collected (incl. GST)": y.collectedTotal,
        GST: y.collectedGst,
        "Income (without GST)": y.collectedBase,
        Expenses: y.expenses,
        Profit: y.profit,
        "Billed (incl. GST)": y.billedTotal,
      }))
    )
  }

  const maxYear = Math.max(1, ...yearly.map((y) => Math.max(y.collectedBase, y.expenses)))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Finance"
        description="Money in, money out and profit — month by month."
        actions={
          <Select value={month} onValueChange={(v) => v && router.push(`/owner-finance?month=${v}`)}>
            <SelectTrigger className="h-11 w-60 cursor-pointer text-base font-semibold">
              <CalendarRange className="size-4 text-muted-foreground" />
              <SelectValue>{(v: string) => monthLabel(v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {months.map((k) => (
                <SelectItem key={k} value={k}>
                  {monthLabel(k)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* The month's money story as one connected sum */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        <SumBox label="Collected" value={m.collectedTotal} hint={`${m.paymentsCount} approved payment${m.paymentsCount === 1 ? "" : "s"}`} tone="text-emerald-700" />
        <Op symbol="−" />
        <SumBox label="GST in it" value={m.collectedGst} hint="Goes to the government" />
        <Op symbol="=" />
        <SumBox label="Income" value={m.collectedBase} hint="Without GST" />
        <Op symbol="−" />
        <SumBox label="Expenses" value={m.expenses} hint={`${expenses.length} entr${expenses.length === 1 ? "y" : "ies"}`} tone="text-rose-700" />
        <Op symbol="=" />
        <SumBox
          label={m.profit >= 0 ? "Profit" : "Loss"}
          value={Math.abs(m.profit)}
          hint={monthLabel(month)}
          tone={m.profit >= 0 ? "text-emerald-700" : "text-rose-700"}
          strong
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="gap-1">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Billed this month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(m.billedTotal)}</p>
            <p className="text-xs text-muted-foreground">Approved services · incl. GST {formatCurrency(m.billedGst)}</p>
          </CardContent>
        </Card>
        <Card className="gap-1">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Still to collect (all months)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-rose-700">{formatCurrency(outstanding)}</p>
            <p className="text-xs text-muted-foreground">What clients owe right now</p>
          </CardContent>
        </Card>
        <Card className="gap-1">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Salaries this month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(expenses.filter((e) => e.category === "Salary").reduce((s, e) => s + e.amount, 0))}</p>
            <p className="text-xs text-muted-foreground">
              {pendingSalaries.length > 0 ? `${pendingSalaries.length} not added yet` : "All added"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ReceiptText className="size-4 text-primary" /> Billed by service
            </CardTitle>
            <CardDescription>Approved services, incl. GST</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList rows={breakdown.byService} empty="No services billed this month." value={(r) => r.total} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" /> Collected by sales person
            </CardTitle>
            <CardDescription>Approved payments, incl. GST</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList rows={breakdown.bySalesPerson} empty="No payments collected this month." value={(r) => r.total} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-primary" /> Spent by category
            </CardTitle>
            <CardDescription>This month&apos;s expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList rows={byCategory} empty="No expenses added yet." value={(r) => r.total} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Expenses — {monthLabel(month)}</CardTitle>
            <CardDescription>Everything the company spent this month.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {salaries.length > 0 ? (
              <Button variant="outline" className="cursor-pointer" onClick={() => { setError(null); setPicked(pendingSalaries.map((s) => s.employeeId)); setSalaryOpen(true) }}>
                <Users /> Add salaries
              </Button>
            ) : null}
            <Button variant="outline" className="cursor-pointer" onClick={exportMonth} disabled={expenses.length === 0}>
              <Download /> Export
            </Button>
            <Button
              className="cursor-pointer"
              onClick={() => {
                setError(null)
                setDraft({ id: null, date: defaultDate, category: "Rent", description: "", amount: "", paidTo: "", paymentMethod: "Bank Transfer", reference: "" })
              }}
            >
              <Plus /> Add expense
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search expenses…" className="h-10 pl-9" />
            </div>
            <Select value={category} onValueChange={(v) => setCategory(v ?? ALL)}>
              <SelectTrigger className="h-10 w-full cursor-pointer sm:w-56">
                <SelectValue>{(v: string) => (v === ALL ? "All categories" : v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && !draft && !salaryOpen ? <p className="text-sm text-destructive">{error}</p> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>What for</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Paid to</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleExpenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm whitespace-nowrap">{formatDate(e.date)}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{e.description}</p>
                    <p className="text-xs text-muted-foreground">{[e.paymentMethod, e.reference].filter(Boolean).join(" · ")}</p>
                  </TableCell>
                  <TableCell>
                    <span className="rounded-full border px-2.5 py-0.5 text-xs font-semibold">{e.category}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.paidTo ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(e.amount)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="cursor-pointer"
                        aria-label="Edit"
                        onClick={() => {
                          setError(null)
                          setDraft({
                            id: e.id,
                            date: e.date,
                            category: e.category,
                            description: e.description,
                            amount: String(e.amount),
                            paidTo: e.paidTo ?? "",
                            paymentMethod: e.paymentMethod ?? "",
                            reference: e.reference ?? "",
                          })
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="cursor-pointer"
                        aria-label="Delete"
                        disabled={busy}
                        onClick={() => window.confirm(`Delete "${e.description}"?`) && call(`/api/finance/expenses/${e.id}`, "DELETE")}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {visibleExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    {expenses.length === 0 ? "No expenses for this month yet. Press “Add expense”." : "No expenses match."}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Last 12 months</CardTitle>
            <CardDescription>Income without GST vs expenses. Click a month to open it.</CardDescription>
          </div>
          <Button variant="outline" className="cursor-pointer" onClick={exportYear}>
            <Download /> Export
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Income</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="w-48">Income vs expenses</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yearly.map((y) => (
                <TableRow
                  key={y.month}
                  className={cn("cursor-pointer", y.month === month && "bg-primary/5")}
                  onClick={() => router.push(`/owner-finance?month=${y.month}`)}
                >
                  <TableCell className="font-medium">{monthLabel(y.month)}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(y.collectedTotal)}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(y.collectedBase)}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(y.expenses)}</TableCell>
                  <TableCell className={cn("text-right text-sm font-semibold", y.profit >= 0 ? "text-emerald-700" : "text-rose-700")}>
                    {y.profit < 0 ? "−" : ""}
                    {formatCurrency(Math.abs(y.profit))}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1" title={`Income ${formatCurrency(y.collectedBase)} · Expenses ${formatCurrency(y.expenses)}`}>
                      <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.max(2, (y.collectedBase / maxYear) * 100)}%` }} />
                      <div className="h-1.5 rounded-full bg-rose-400" style={{ width: `${Math.max(2, (y.expenses / maxYear) * 100)}%` }} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full bg-emerald-500" /> Income
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full bg-rose-400" /> Expenses
            </span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">{draft?.id ? "Edit expense" : "Add expense"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="What for" htmlFor="fx-desc" required>
                <Input id="fx-desc" className="h-10 text-base" placeholder="e.g. Office rent" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
              <Field label="Amount (₹)" htmlFor="fx-amt" required>
                <Input id="fx-amt" type="number" min="0" className="h-10 text-base" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
              </Field>
              <Field label="Category" htmlFor="fx-cat">
                <TextSelect id="fx-cat" value={draft.category} onChange={(v) => setDraft({ ...draft, category: (v || "Other") as ExpenseCategory })} options={EXPENSE_CATEGORIES} placeholder="Select" />
              </Field>
              <Field label="Date" htmlFor="fx-date">
                <Input id="fx-date" type="date" className="h-10 text-base" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </Field>
              <Field label="Paid to" htmlFor="fx-to">
                <Input id="fx-to" className="h-10 text-base" placeholder="Person or company" value={draft.paidTo} onChange={(e) => setDraft({ ...draft, paidTo: e.target.value })} />
              </Field>
              <Field label="Paid by" htmlFor="fx-method">
                <TextSelect id="fx-method" value={draft.paymentMethod} onChange={(v) => setDraft({ ...draft, paymentMethod: v })} options={EXPENSE_METHODS} placeholder="Select" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Reference" htmlFor="fx-ref">
                  <Input id="fx-ref" className="h-10 text-base" placeholder="Bill no. / UTR (optional)" value={draft.reference} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} />
                </Field>
              </div>
              {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button className="cursor-pointer" disabled={busy || !draft?.description.trim() || !draft?.amount} onClick={saveDraft}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={salaryOpen} onOpenChange={setSalaryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Add salaries — {monthLabel(month)}</DialogTitle>
            <DialogDescription>Each person&apos;s monthly salary from their profile. Already-added people are skipped.</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
            {salaries.map((s) => {
              const checked = picked.includes(s.employeeId)
              return (
                <label
                  key={s.employeeId}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
                    s.alreadyAdded ? "opacity-50" : "cursor-pointer hover:bg-accent/50"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      disabled={s.alreadyAdded}
                      checked={checked}
                      onChange={() => setPicked((p) => (checked ? p.filter((x) => x !== s.employeeId) : [...p, s.employeeId]))}
                    />
                    <span className="text-sm font-medium">{s.name}</span>
                  </span>
                  <span className="text-sm">{s.alreadyAdded ? "Added" : formatCurrency(s.salary)}</span>
                </label>
              )
            })}
            {salaries.length === 0 ? <p className="text-sm text-muted-foreground">Set salaries on employee profiles first.</p> : null}
          </div>
          <p className="text-sm font-semibold">
            Total: {formatCurrency(salaries.filter((s) => picked.includes(s.employeeId)).reduce((t, s) => t + s.salary, 0))}
          </p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setSalaryOpen(false)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              disabled={busy || picked.length === 0}
              onClick={async () => {
                if (await call("/api/finance/salaries", "POST", { month, employeeIds: picked })) setSalaryOpen(false)
              }}
            >
              {busy ? "Adding…" : `Add ${picked.length} salar${picked.length === 1 ? "y" : "ies"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

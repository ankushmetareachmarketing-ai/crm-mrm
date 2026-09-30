"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Laptop, Plus, Search } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Field, OptionSelect, TextSelect } from "@/components/hr/form-bits"
import { ASSET_CATEGORIES } from "@/lib/hr/constants"
import type { AssetRow, NamedOption } from "@/lib/hr/types"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const STATUS_STYLE: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Assigned: "bg-sky-50 text-sky-700 border-sky-200",
  "Under Repair": "bg-amber-50 text-amber-700 border-amber-200",
  Retired: "bg-slate-100 text-slate-600 border-slate-200",
}

export function AssetsClient({ assets, people }: { assets: AssetRow[]; people: NamedOption[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ assetTag: "", name: "", category: "Laptop", serialNumber: "", notes: "" })
  const [assigning, setAssigning] = useState<AssetRow | null>(null)
  const [assignee, setAssignee] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return assets
    return assets.filter((a) => [a.assetTag, a.name, a.category, a.serialNumber, a.holder].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
  }, [assets, query])

  async function post(url: string, body: object) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Could not save.")
        return false
      }
      router.refresh()
      return true
    } finally {
      setBusy(false)
    }
  }

  const count = (s: string) => assets.filter((a) => a.status === s).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Assets"
        description="Laptops, phones, SIMs and ID cards — who has what."
        actions={
          <Button className="cursor-pointer" onClick={() => { setError(null); setAdding(true) }}>
            <Plus /> Add asset
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total assets" value={String(assets.length)} icon={Laptop} />
        <StatCard label="With employees" value={String(count("Assigned"))} icon={Laptop} />
        <StatCard label="Available" value={String(count("Available"))} icon={Laptop} />
        <StatCard label="Under repair" value={String(count("Under Repair"))} icon={Laptop} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tag, name, serial number or person…" className="h-10 pl-9 text-base" />
          </div>
          {error && !adding && !assigning ? <p className="text-sm text-destructive">{error}</p> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>With</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{a.assetTag}</span>
                      {a.serialNumber ? ` · S/N ${a.serialNumber}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">{a.category}</TableCell>
                  <TableCell className="text-sm">
                    {a.holderId ? (
                      <>
                        <Link href={`/hr/employees/${a.holderId}`} className="font-medium hover:underline">
                          {a.holder}
                        </Link>
                        <p className="text-xs text-muted-foreground">since {formatDate(a.assignedAt)}</p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[a.status])}>{a.status}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {a.status === "Available" ? (
                        <Button size="sm" className="cursor-pointer" onClick={() => { setError(null); setAssignee(""); setAssigning(a) }}>
                          Give to…
                        </Button>
                      ) : null}
                      {a.status === "Assigned" ? (
                        <Button size="sm" variant="outline" className="cursor-pointer" disabled={busy} onClick={() => window.confirm(`Mark ${a.name} as returned?`) && post(`/api/hr/assets/${a.id}`, { action: "return" })}>
                          Mark returned
                        </Button>
                      ) : null}
                      {a.status === "Available" ? (
                        <Button size="sm" variant="ghost" className="cursor-pointer" disabled={busy} onClick={() => post(`/api/hr/assets/${a.id}`, { action: "status", status: "Under Repair" })}>
                          Repair
                        </Button>
                      ) : null}
                      {a.status === "Under Repair" ? (
                        <Button size="sm" variant="outline" className="cursor-pointer" disabled={busy} onClick={() => post(`/api/hr/assets/${a.id}`, { action: "status", status: "Available" })}>
                          Back from repair
                        </Button>
                      ) : null}
                      {a.status !== "Assigned" && a.status !== "Retired" ? (
                        <Button size="sm" variant="ghost" className="cursor-pointer text-muted-foreground" disabled={busy} onClick={() => window.confirm(`Retire ${a.name}?`) && post(`/api/hr/assets/${a.id}`, { action: "status", status: "Retired" })}>
                          Retire
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No assets yet. Add laptops, phones, SIM cards or ID cards here.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Add asset</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Asset tag" htmlFor="as-tag" required hint="Your own label, e.g. LAP-001">
              <Input id="as-tag" className="h-10 text-base" value={form.assetTag} onChange={(e) => setForm({ ...form, assetTag: e.target.value })} />
            </Field>
            <Field label="Category" htmlFor="as-cat">
              <TextSelect id="as-cat" value={form.category} onChange={(v) => setForm({ ...form, category: v || "Other" })} options={ASSET_CATEGORIES} placeholder="Select" />
            </Field>
            <Field label="Name / model" htmlFor="as-name" required>
              <Input id="as-name" className="h-10 text-base" placeholder="e.g. Dell Latitude 5420" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Serial number" htmlFor="as-serial">
              <Input id="as-serial" className="h-10 text-base" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
            </Field>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              disabled={busy || !form.assetTag.trim() || !form.name.trim()}
              onClick={async () => {
                if (await post("/api/hr/assets", form)) {
                  setAdding(false)
                  setForm({ assetTag: "", name: "", category: "Laptop", serialNumber: "", notes: "" })
                }
              }}
            >
              {busy ? "Saving…" : "Add asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assigning} onOpenChange={(v) => !v && setAssigning(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Give {assigning?.name}</DialogTitle>
          </DialogHeader>
          <Field label="Employee" htmlFor="as-emp">
            <OptionSelect id="as-emp" value={assignee} onChange={setAssignee} options={people} placeholder="Select employee" />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setAssigning(null)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              disabled={busy || !assignee}
              onClick={async () => {
                if (assigning && (await post(`/api/hr/assets/${assigning.id}`, { action: "assign", employeeId: assignee }))) setAssigning(null)
              }}
            >
              {busy ? "Saving…" : "Give asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

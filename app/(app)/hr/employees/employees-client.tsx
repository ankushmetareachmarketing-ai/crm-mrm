"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency } from "@/lib/format"
import type { Employee } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function EmployeesClient({ employees }: { employees: Employee[] }) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.loginId.toLowerCase().includes(q) ||
        (e.department ?? "").toLowerCase().includes(q)
    )
  }, [employees, query])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Employees"
        description="Salary, credentials and profile details for every employee."
        actions={
          <Button size="sm" nativeButton={false} render={<Link href="/hr/employees/new" />}>
            <Plus /> Add employee
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, login ID or department…"
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Login ID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{e.loginId}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.profile}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.department ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.employmentType}</TableCell>
                  <TableCell className="text-right text-sm">
                    {e.salary ? formatCurrency(e.salary) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={e.active ? "Active" : "Inactive"} />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/hr/employees/${e.id}`} />}
                    >
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No employees match your search.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

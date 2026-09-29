"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, Plus, Search, UserCheck, Users } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { EmployeeAvatar, EmployeeStatusBadge } from "@/components/hr/employee-bits"
import { EMPLOYEE_STATUSES } from "@/lib/hr/constants"
import type { EmployeeSummary, OrgOptions } from "@/lib/hr/types"
import { formatDate } from "@/lib/format"
import { downloadCsv } from "@/lib/export-csv"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
const NONE = "none"

export function EmployeesClient({ employees, org }: { employees: EmployeeSummary[]; org: OrgOptions }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [department, setDepartment] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [role, setRole] = useState(ALL)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return employees.filter((e) => {
      if (department === NONE ? e.departmentId !== null : department !== ALL && e.departmentId !== department) return false
      if (status !== ALL && e.status !== status) return false
      if (role !== ALL && e.role !== role) return false
      if (!q) return true
      return [e.name, e.code, e.contact, e.workEmail, e.designation, e.department, e.manager]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    })
  }, [employees, query, department, status, role])

  const count = (s: string[]) => employees.filter((e) => s.includes(e.status)).length
  const deptName = (id: string) => (id === ALL ? "All departments" : id === NONE ? "No department" : org.departments.find((d) => d.id === id)?.name ?? id)

  function exportList() {
    downloadCsv(
      "employees.csv",
      visible.map((e) => ({
        "Employee ID": e.code,
        Name: e.name,
        Department: e.department ?? "",
        Designation: e.designation ?? "",
        Team: e.team ?? "",
        Manager: e.manager ?? "",
        Role: e.role,
        Status: e.status,
        Phone: e.contact,
        "Work email": e.workEmail ?? "",
        "Joining date": e.joiningDate,
        "Employment type": e.employmentType,
      }))
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Employees"
        description="Everyone in the company — profile, department, manager and status."
        actions={
          <>
            <Button variant="outline" className="cursor-pointer" onClick={exportList} disabled={visible.length === 0}>
              Export CSV
            </Button>
            <Button className="cursor-pointer" nativeButton={false} render={<Link href="/hr/employees/new" />}>
              <Plus /> Add employee
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total employees" value={String(employees.length)} icon={Users} />
        <StatCard label="Working now" value={String(count(["Active", "Probation", "Notice Period"]))} icon={UserCheck} hint="Active, probation & notice" />
        <StatCard label="Onboarding" value={String(count(["Onboarding"]))} icon={Plus} hint="Joining in progress" href="/hr/onboarding" />
        <StatCard label="Left the company" value={String(count(["Resigned", "Terminated", "Inactive"]))} icon={Users} hint="Resigned, terminated or inactive" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, employee ID, phone, email, designation…"
                className="h-10 pl-9 text-base"
              />
            </div>
            <Select value={department} onValueChange={(v) => setDepartment(v ?? ALL)}>
              <SelectTrigger className="h-10 w-full cursor-pointer lg:w-52">
                <SelectValue>{(v: string) => deptName(v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All departments</SelectItem>
                {org.departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
                <SelectItem value={NONE}>No department</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v ?? ALL)}>
              <SelectTrigger className="h-10 w-full cursor-pointer lg:w-44">
                <SelectValue>{(v: string) => (v === ALL ? "All statuses" : v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {EMPLOYEE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={role} onValueChange={(v) => setRole(v ?? ALL)}>
              <SelectTrigger className="h-10 w-full cursor-pointer lg:w-44">
                <SelectValue>{(v: string) => (v === ALL ? "All roles" : v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All roles</SelectItem>
                {org.roles.map((r) => (
                  <SelectItem key={r.id} value={r.name}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department &amp; designation</TableHead>
                <TableHead>Reports to</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((e) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => router.push(`/hr/employees/${e.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar name={e.name} photoUrl={e.photoUrl} />
                      <div className="min-w-0">
                        <Link
                          href={`/hr/employees/${e.id}`}
                          className="font-medium hover:underline"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          {e.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {e.code} · {e.contact}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{e.designation ?? <span className="text-muted-foreground">No designation</span>}</p>
                    <p className="text-xs text-muted-foreground">
                      {[e.department, e.team].filter(Boolean).join(" · ") || "No department"}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.manager ?? "—"}</TableCell>
                  <TableCell className="text-sm">{e.role}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{formatDate(e.joiningDate)}</TableCell>
                  <TableCell>
                    <EmployeeStatusBadge status={e.status} />
                    {!e.active && e.status !== "Inactive" ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">Login off</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No employees match these filters.
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

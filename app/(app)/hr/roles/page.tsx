import Link from "next/link"
import { ShieldAlert } from "@/components/icons"
import { PageHeader } from "@/components/page-header"
import { EmployeeAvatar } from "@/components/hr/employee-bits"
import { getEmployeeDirectory } from "@/lib/data/hr"
import { ACCESS_LABEL, PERMISSIONS, ROLE_COLUMNS, type Access } from "@/lib/hr/permissions"
import { requireHrManager } from "@/lib/hr/server"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ACCESS_STYLE: Record<Access, string> = {
  full: "bg-emerald-50 text-emerald-700 border-emerald-200",
  own: "bg-sky-50 text-sky-700 border-sky-200",
  view: "bg-slate-50 text-slate-600 border-slate-200",
  none: "text-muted-foreground border-transparent",
}

export default async function RolesPage() {
  await requireHrManager()
  const employees = (await getEmployeeDirectory()).filter((e) => e.active)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Roles & permissions"
        description="Each employee has one role. The role decides what they can see and do. Change someone's role from their profile."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {ROLE_COLUMNS.map((role) => {
          const members = employees.filter((e) => e.role === role)
          return (
            <Card key={role} className="gap-2">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldAlert className="size-4 text-primary" /> {role}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{members.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {members.map((m) => (
                  <Link key={m.id} href={`/hr/employees/${m.id}`} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent">
                    <EmployeeAvatar name={m.name} photoUrl={m.photoUrl} className="size-6 text-[10px]" />
                    <span className="truncate">{m.name}</span>
                  </Link>
                ))}
                {members.length === 0 ? <p className="text-xs text-muted-foreground">Nobody</p> : null}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What each role can do</CardTitle>
          <CardDescription>
            <b>Full</b> = everyone&apos;s records · <b>Own only</b> = just their own (or their assigned clients) · <b>View</b> = read only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Permission</TableHead>
                {ROLE_COLUMNS.map((r) => (
                  <TableHead key={r} className="text-center">
                    {r}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSIONS.flatMap((group) => [
                <TableRow key={group.area} className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={ROLE_COLUMNS.length + 1} className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    {group.area}
                  </TableCell>
                </TableRow>,
                ...group.items.map((item) => (
                  <TableRow key={`${group.area}-${item.label}`}>
                    <TableCell className="text-sm font-medium">{item.label}</TableCell>
                    {ROLE_COLUMNS.map((r) => (
                      <TableCell key={r} className="text-center">
                        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", ACCESS_STYLE[item.access[r]])}>
                          {ACCESS_LABEL[item.access[r]]}
                        </span>
                      </TableCell>
                    ))}
                  </TableRow>
                )),
              ])}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            These rules are built into the app. Ask your developer if a role needs different access.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

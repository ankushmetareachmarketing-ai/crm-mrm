import { EMPLOYEE_STATUS_STYLE, type EmployeeStatus } from "@/lib/hr/constants"
import { getInitials } from "@/lib/format"
import { cn } from "@/lib/utils"

export function EmployeeStatusBadge({ status, className }: { status: EmployeeStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        EMPLOYEE_STATUS_STYLE[status] ?? "bg-slate-100 text-slate-600 border-slate-200",
        className
      )}
    >
      {status}
    </span>
  )
}

export function EmployeeAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string
  photoUrl: string | null
  className?: string
}) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" className={cn("size-9 shrink-0 rounded-full border object-cover", className)} />
  }
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary",
        className
      )}
    >
      {getInitials(name) || "?"}
    </span>
  )
}

/** A label + value pair for read-only detail grids. */
export function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-medium break-words">{value || <span className="text-muted-foreground">—</span>}</span>
    </div>
  )
}

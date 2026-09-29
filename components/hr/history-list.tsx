import type { EmployeeHistoryEntry } from "@/lib/hr/types"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const TONE: Record<string, string> = {
  Joined: "bg-emerald-500",
  "Employee activated": "bg-emerald-500",
  "Onboarding started": "bg-violet-500",
  "Status changed": "bg-amber-500",
  "Role changed": "bg-rose-500",
  "Department changed": "bg-sky-500",
  "Designation changed": "bg-sky-500",
  "Manager changed": "bg-sky-500",
  "Leave approved": "bg-teal-500",
}

/** Everything that happened to an employee, newest first. */
export function HistoryList({ entries }: { entries: EmployeeHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No history yet.</p>
  }
  return (
    <ol className="flex flex-col">
      {entries.map((h, i) => (
        <li key={h.id} className="relative flex gap-4 pb-5 last:pb-0">
          {i < entries.length - 1 ? <span aria-hidden className="absolute top-4 bottom-0 left-[5px] w-px bg-border" /> : null}
          <span className={cn("relative mt-1.5 size-3 shrink-0 rounded-full ring-4 ring-background", TONE[h.action] ?? "bg-slate-400")} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-semibold">
                {h.action}
                {h.field && h.action !== h.field ? <span className="font-normal text-muted-foreground"> · {h.field}</span> : null}
              </p>
              <time className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</time>
            </div>
            {h.before || h.after ? (
              <p className="text-sm text-muted-foreground">
                {h.before ? <span className="line-through decoration-slate-400">{h.before}</span> : null}
                {h.before && h.after ? " → " : null}
                {h.after ? <span className="font-medium text-foreground">{h.after}</span> : null}
              </p>
            ) : null}
            {h.actor ? <p className="text-xs text-muted-foreground">by {h.actor}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

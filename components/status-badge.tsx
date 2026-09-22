import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  // success
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Posted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Configured: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Received: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Converted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Interested: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Created: "bg-emerald-50 text-emerald-700 border-emerald-200",
  // warning
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Submitted: "bg-amber-50 text-amber-700 border-amber-200",
  Queued: "bg-amber-50 text-amber-700 border-amber-200",
  "Partially Completed": "bg-amber-50 text-amber-700 border-amber-200",
  "Awaiting Client": "bg-amber-50 text-amber-700 border-amber-200",
  "On Hold": "bg-amber-50 text-amber-700 border-amber-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  // danger
  Rejected: "bg-rose-50 text-rose-700 border-rose-200",
  Failed: "bg-rose-50 text-rose-700 border-rose-200",
  Cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  Lost: "bg-rose-50 text-rose-700 border-rose-200",
  Urgent: "bg-rose-50 text-rose-700 border-rose-200",
  High: "bg-rose-50 text-rose-700 border-rose-200",
  "Incomplete Costing": "bg-rose-50 text-rose-700 border-rose-200",
  "Not configured": "bg-rose-50 text-rose-700 border-rose-200",
  Payable: "bg-rose-50 text-rose-700 border-rose-200",
  "Not Interested": "bg-rose-50 text-rose-700 border-rose-200",
  "Invalid Number": "bg-rose-50 text-rose-700 border-rose-200",
  Overdue: "bg-rose-50 text-rose-700 border-rose-200",
  Deleted: "bg-rose-50 text-rose-700 border-rose-200",
  // info
  Running: "bg-sky-50 text-sky-700 border-sky-200",
  "In Progress": "bg-sky-50 text-sky-700 border-sky-200",
  Contacted: "bg-sky-50 text-sky-700 border-sky-200",
  "Meeting Scheduled": "bg-sky-50 text-sky-700 border-sky-200",
  New: "bg-sky-50 text-sky-700 border-sky-200",
  Advance: "bg-sky-50 text-sky-700 border-sky-200",
  Field: "bg-sky-50 text-sky-700 border-sky-200",
  "Call Back": "bg-sky-50 text-sky-700 border-sky-200",
  Updated: "bg-sky-50 text-sky-700 border-sky-200",
  // neutral
  Draft: "bg-slate-100 text-slate-600 border-slate-200",
  Closed: "bg-slate-100 text-slate-600 border-slate-200",
  Inactive: "bg-slate-100 text-slate-600 border-slate-200",
  Returned: "bg-slate-100 text-slate-600 border-slate-200",
  Low: "bg-slate-100 text-slate-600 border-slate-200",
  Open: "bg-slate-100 text-slate-600 border-slate-200",
  Office: "bg-slate-100 text-slate-600 border-slate-200",
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const style = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 border-slate-200"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        style,
        className
      )}
    >
      {status}
    </span>
  )
}

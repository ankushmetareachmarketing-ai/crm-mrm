"use client"

import { useMemo, useState } from "react"
import { SearchField } from "@/components/search-field"
import type { ActivityEntry } from "@/lib/types"
import { formatRelativeTime } from "@/lib/format"
import { CardContent } from "@/components/ui/card"

export function ClientActivityPanel({ activity }: { activity: ActivityEntry[] }) {
  const [query, setQuery] = useState("")
  const visibleActivity = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return activity
    return activity.filter((item) =>
      [item.action, item.actor, item.detail].filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    )
  }, [activity, query])

  return (
    <CardContent className="flex flex-col gap-4">
      <SearchField
        className="w-full sm:max-w-sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search activity by action, person, details…"
      />
      <div className="flex flex-col gap-3">
        {visibleActivity.map((item) => (
          <div key={item.id} className="flex gap-3 border-b pb-3 last:border-0">
            <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
            <div>
              <p className="text-sm font-medium">
                {item.action}
                {item.actor ? <span className="font-normal text-muted-foreground"> · {item.actor}</span> : null}
              </p>
              {item.detail ? <p className="text-sm text-muted-foreground">{item.detail}</p> : null}
              <p className="text-xs text-muted-foreground">{formatRelativeTime(item.createdAt)}</p>
            </div>
          </div>
        ))}
        {visibleActivity.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {query ? "No activity matches your search." : "No activity recorded yet."}
          </p>
        ) : null}
      </div>
    </CardContent>
  )
}
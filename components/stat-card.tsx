import Link from "next/link"
import type { IconComponent } from "@/components/icons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendTone = "neutral",
  hint,
  href,
}: {
  label: string
  value: string
  icon: IconComponent
  trend?: string
  trendTone?: "up" | "down" | "neutral"
  hint?: string
  href?: string
}) {
  const content = (
    <Card className={cn("gap-2", href && "cursor-pointer transition-colors hover:bg-accent/50")}>
      <CardHeader className="flex flex-row items-center justify-between pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {trend ? (
          <p
            className={cn(
              "mt-1 text-xs",
              trendTone === "up" && "text-emerald-600",
              trendTone === "down" && "text-rose-600",
              trendTone === "neutral" && "text-muted-foreground"
            )}
          >
            {trend}
          </p>
        ) : hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  )

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  )
}

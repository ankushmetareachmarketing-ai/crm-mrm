"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, LogIn, LogOut } from "@/components/icons"
import { attendanceMetrics, type HrSettings } from "@/lib/hr/attendance"
import { formatMinutes, formatOfficeTime, officeDateKey } from "@/lib/hr/time"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Today {
  checkInAt: string | null
  checkOutAt: string | null
  status: string | null
}

/** Today's check-in / check-out for the signed-in employee. */
export function CheckInCard({ today, settings, employeeId }: { today: Today; settings: HrSettings; employeeId: string }) {
  const router = useRouter()
  const [state, setState] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  const onLeave = state.status === "On Leave"
  const metrics = state.checkInAt
    ? attendanceMetrics(
        { employeeId, workDate: officeDateKey(now), checkInAt: state.checkInAt, checkOutAt: state.checkOutAt, status: "Present" },
        settings,
        now
      )
    : null

  async function act(action: "in" | "out") {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/attendance/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? "Could not save.")
        return
      }
      setState({ checkInAt: body.checkInAt, checkOutAt: body.checkOutAt, status: body.status })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const clock = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" }).format(now)

  return (
    <Card className={cn("border-2", state.checkInAt && !state.checkOutAt ? "border-emerald-200 bg-emerald-50/40" : "")}>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Clock className="size-6" />
          </span>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{clock}</p>
            <p className="text-lg font-bold">
              {onLeave
                ? "You're on leave today"
                : !state.checkInAt
                  ? "You haven't checked in yet"
                  : !state.checkOutAt
                    ? `Checked in at ${formatOfficeTime(state.checkInAt)}`
                    : `Done for today — ${formatMinutes(metrics?.workedMinutes ?? 0)}`}
            </p>
            <p className="text-sm text-muted-foreground">
              {state.checkInAt && !state.checkOutAt && metrics
                ? `Working for ${formatMinutes(metrics.workedMinutes)}${metrics.isLate ? ` · ${metrics.lateMinutes} min late` : ""}`
                : state.checkOutAt
                  ? `${formatOfficeTime(state.checkInAt)} – ${formatOfficeTime(state.checkOutAt)} · ${state.status}`
                  : `Office starts at ${settings.officeStart}`}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          {!onLeave && !state.checkInAt ? (
            <Button className="h-11 cursor-pointer px-6 text-base font-semibold" onClick={() => act("in")} disabled={busy}>
              <LogIn /> {busy ? "Checking in…" : "Check in"}
            </Button>
          ) : null}
          {state.checkInAt && !state.checkOutAt ? (
            <Button
              variant="outline"
              className="h-11 cursor-pointer border-rose-300 px-6 text-base font-semibold text-rose-700 hover:bg-rose-50"
              onClick={() => act("out")}
              disabled={busy}
            >
              <LogOut /> {busy ? "Checking out…" : "Check out"}
            </Button>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}

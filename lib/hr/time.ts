// The office runs on India time. Servers (Vercel) run in UTC, so every
// "today", "work date" and clock time for HR must be computed in this zone
// explicitly — never from a bare new Date().toISOString().

export const OFFICE_TZ = "Asia/Kolkata"

/** YYYY-MM-DD of the given moment in office time. */
export function officeDateKey(at: Date | string = new Date()): string {
  const d = typeof at === "string" ? new Date(at) : at
  return new Intl.DateTimeFormat("en-CA", { timeZone: OFFICE_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d)
}

/** Minutes since office-time midnight for the given moment. */
export function officeMinutesOfDay(at: Date | string): number {
  const d = typeof at === "string" ? new Date(at) : at
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OFFICE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d)
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0)
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0)
  return h * 60 + m
}

/** "9:42 am" in office time. */
export function formatOfficeTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("en-IN", { timeZone: OFFICE_TZ, hour: "numeric", minute: "2-digit" }).format(d)
}

/** "10:00" (a Postgres time) → minutes since midnight. */
export function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** 0 = Sunday … 6 = Saturday for a YYYY-MM-DD calendar date. */
export function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay()
}

/** Every calendar date from start to end, inclusive (YYYY-MM-DD). */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = []
  const cur = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  while (cur <= last && out.length < 400) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

export function formatMinutes(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return "0h"
  const h = Math.floor(total / 60)
  const m = Math.round(total % 60)
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

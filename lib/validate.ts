/** Plain `YYYY-MM-DD` calendar date, and an actually-real date (rejects 2026-02-30). */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** 24-hour `HH:MM`. */
export function isValidTimeString(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function isPositiveNumber(value: unknown): boolean {
  const n = Number(value)
  return Number.isFinite(n) && n > 0
}

export function isNonNegativeNumber(value: unknown): boolean {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0
}

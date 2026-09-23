import "server-only"

/**
 * Structured error logging for server code (API routes, Server Components).
 * Logs as a single JSON line so Vercel's log viewer (and any log drain) can
 * filter/search by route or message, instead of a bare stack trace.
 */
export function logError(context: string, error: unknown, extra?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  console.error(
    JSON.stringify({
      level: "error",
      context,
      message,
      stack,
      ...extra,
      time: new Date().toISOString(),
    })
  )
}

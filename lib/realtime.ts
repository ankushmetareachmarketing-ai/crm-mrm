import "server-only"
import { createHmac } from "crypto"

// Supabase Realtime is used only to *ping* the browser when a notification
// arrives (see supabase/migrations/20260924030000_realtime_notification_pings.sql).
// Login is NextAuth, not Supabase Auth, so the server mints a short-lived
// Supabase-compatible JWT for the signed-in employee; RLS on
// realtime.messages lets it join only `notifications:<its own id>`.
//
// Needs two values from Supabase → Project Settings → API:
//   SUPABASE_ANON_KEY    public "anon" key (safe to send to the browser)
//   SUPABASE_JWT_SECRET  legacy JWT secret (server only — never expose)
// Without them the bell simply keeps polling every 10 seconds.

const TOKEN_TTL_SECONDS = 60 * 60

export function isRealtimeConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_JWT_SECRET)
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url")
}

/** HS256 JWT for Supabase Realtime, identifying the employee as `sub`. */
export function mintRealtimeToken(employeeId: string) {
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + TOKEN_TTL_SECONDS
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const payload = base64url(
    JSON.stringify({ sub: employeeId, role: "authenticated", aud: "authenticated", iat: now, exp: expiresAt })
  )
  const signature = createHmac("sha256", process.env.SUPABASE_JWT_SECRET!).update(`${header}.${payload}`).digest()
  return { token: `${header}.${payload}.${base64url(signature)}`, expiresAt }
}

export function notificationTopic(employeeId: string) {
  return `notifications:${employeeId}`
}

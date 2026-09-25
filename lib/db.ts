import "server-only"
import { Pool } from "pg"

declare global {
  var _pgPool: Pool | undefined
}

/**
 * A single shared connection pool. Reused across hot reloads in dev so we
 * don't leak connections on every file edit.
 *
 * `max` is kept low on purpose: in serverless (Vercel), every cold container
 * builds its own Pool, and each one can hold up to `max` connections at
 * once — several can be warm concurrently, and a single request's
 * `Promise.all([...])` of dashboard queries can grab several connections
 * from its own pool simultaneously. Supabase's session pooler caps total
 * concurrent clients project-wide (its page pooler quota), which a handful
 * of warm containers each opening up to the pg default of 10 can blow
 * through fast (EMAXCONNSESSION). DATABASE_URL should point at Supabase's
 * *transaction* pooler (port 6543, not 5432) for the same reason — it
 * multiplexes far more concurrent clients than session mode.
 */
const isRemoteDb = /supabase\.com/.test(process.env.DATABASE_URL ?? "")

export const pool =
  globalThis._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
    max: isRemoteDb ? 3 : 10,
    idleTimeoutMillis: 10_000,
  })

if (process.env.NODE_ENV !== "production") {
  globalThis._pgPool = pool
}

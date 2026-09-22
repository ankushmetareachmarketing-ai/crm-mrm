import "server-only"
import { Pool } from "pg"

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined
}

/**
 * A single shared connection pool to the local Postgres database (the same
 * one the Supabase CLI provisions — we only use it as a plain Postgres
 * instance now, not through Supabase's Auth/PostgREST layer). Reused across
 * hot reloads in dev so we don't leak connections on every file edit.
 */
const isRemoteDb = /supabase\.com/.test(process.env.DATABASE_URL ?? "")

export const pool =
  globalThis._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
  })

if (process.env.NODE_ENV !== "production") {
  globalThis._pgPool = pool
}

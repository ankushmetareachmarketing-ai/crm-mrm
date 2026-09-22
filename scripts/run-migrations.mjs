// One-off helper: applies every migration file in supabase/migrations against
// whatever DATABASE_URL points at. Used to set up a fresh Supabase project's
// schema without needing the Supabase CLI logged in.
//
//   DATABASE_URL=... node scripts/run-migrations.mjs

import { Client } from "pg"
import { readFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("Set DATABASE_URL first.")
  process.exit(1)
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, "..", "supabase", "migrations")
const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), "utf8")
  console.log(`Applying ${file} ...`)
  await client.query(sql)
  console.log(`  ok`)
}

console.log("All migrations applied.")
await client.end()

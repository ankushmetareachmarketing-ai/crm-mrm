// One-off script: creates the public Storage buckets used for client logos
// and employee photos. Safe to re-run — existing buckets are left alone.
//
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/setup-storage.mjs

import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.")
  process.exit(1)
}

const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const buckets = ["client-logos", "employee-photos"]

for (const bucket of buckets) {
  const { data: existing } = await client.storage.getBucket(bucket)
  if (existing) {
    console.log(`Bucket "${bucket}" already exists.`)
    continue
  }
  const { error } = await client.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: "5MB",
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  })
  if (error) {
    console.error(`Could not create bucket "${bucket}":`, error.message)
    continue
  }
  console.log(`Created bucket "${bucket}".`)
}

import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"

// Storage-only client (auth itself is NextAuth). Service role key bypasses
// bucket policies — only ever call this from trusted server-side code.
// Built lazily so importing this module doesn't require the env vars at
// build time (Next.js evaluates route modules while collecting page data).
let storageClient: SupabaseClient | undefined

function getStorageClient(): SupabaseClient {
  if (!storageClient) {
    storageClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return storageClient
}

export type UploadKind = "client-logos" | "employee-photos"

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"])

export async function uploadImage(kind: UploadKind, file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Only PNG, JPEG, WEBP or SVG images are allowed.")
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Image must be under 5MB.")
  }

  const extension = file.name.split(".").pop() || "png"
  const path = `${randomUUID()}.${extension}`

  const client = getStorageClient()
  const { error } = await client.storage.from(kind).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(error.message)

  const { data } = client.storage.from(kind).getPublicUrl(path)
  return data.publicUrl
}

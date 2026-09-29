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

// ---------------------------------------------------------------------
// Employee documents (Aadhaar, PAN, certificates…) live in a PRIVATE
// bucket. Files are never public: the app checks who is asking, then
// hands out a signed URL that expires after a minute.
// ---------------------------------------------------------------------

const DOCUMENTS_BUCKET = "employee-documents"
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024 // 10MB
const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

let documentsBucketReady = false

/** Creates the private bucket the first time a document is uploaded. */
async function ensureDocumentsBucket(client: SupabaseClient) {
  if (documentsBucketReady) return
  const { data } = await client.storage.getBucket(DOCUMENTS_BUCKET)
  if (!data) {
    const { error } = await client.storage.createBucket(DOCUMENTS_BUCKET, {
      public: false,
      fileSizeLimit: MAX_DOCUMENT_BYTES,
    })
    if (error && !/already exists/i.test(error.message)) throw new Error(error.message)
  }
  documentsBucketReady = true
}

export async function uploadEmployeeDocument(employeeId: string, file: File) {
  if (!DOCUMENT_TYPES.has(file.type)) {
    throw new Error("Only PDF, Word, PNG, JPEG or WEBP files are allowed.")
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error("File must be under 10MB.")
  }
  const client = getStorageClient()
  await ensureDocumentsBucket(client)
  const extension = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "")
  const path = `${employeeId}/${randomUUID()}.${extension}`
  const { error } = await client.storage.from(DOCUMENTS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return path
}

export async function signedEmployeeDocumentUrl(path: string, downloadName?: string) {
  const { data, error } = await getStorageClient()
    .storage.from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, 60, downloadName ? { download: downloadName } : undefined)
  if (error || !data) throw new Error(error?.message ?? "Could not open this document.")
  return data.signedUrl
}

export async function deleteEmployeeDocument(path: string) {
  await getStorageClient().storage.from(DOCUMENTS_BUCKET).remove([path])
}

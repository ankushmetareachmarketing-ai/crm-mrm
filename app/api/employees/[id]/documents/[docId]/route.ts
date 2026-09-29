import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { canManageHr, recordEmployeeHistory } from "@/lib/hr/server"
import { deleteEmployeeDocument, signedEmployeeDocumentUrl } from "@/lib/storage"

const UUID = /^[0-9a-f-]{36}$/i

async function load(params: Promise<{ id: string; docId: string }>) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return { response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) }
  const { id, docId } = await params
  if (!UUID.test(id) || !UUID.test(docId)) return { response: NextResponse.json({ error: "Not found." }, { status: 404 }) }
  if (caller.id !== id && !canManageHr(caller.role)) {
    return { response: NextResponse.json({ error: "Not found." }, { status: 404 }) }
  }
  const { rows } = await pool.query<{ storage_path: string; file_name: string; title: string; category: string }>(
    `select storage_path, file_name, title, category from public.employee_documents where id = $1 and employee_id = $2`,
    [docId, id]
  )
  if (!rows[0]) return { response: NextResponse.json({ error: "Not found." }, { status: 404 }) }
  return { caller, id, docId, doc: rows[0] }
}

/** Opens the document through a signed URL that expires in a minute. `?download=1` saves it instead. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const r = await load(params)
  if ("response" in r) return r.response
  const download = new URL(request.url).searchParams.get("download") === "1"
  try {
    const url = await signedEmployeeDocumentUrl(r.doc.storage_path, download ? r.doc.file_name : undefined)
    return NextResponse.redirect(url)
  } catch {
    return NextResponse.json({ error: "Could not open this document." }, { status: 500 })
  }
}

/** Only HR / Owner can delete documents. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const r = await load(params)
  if ("response" in r) return r.response
  if (!canManageHr(r.caller.role)) {
    return NextResponse.json({ error: "Only HR or the Owner can delete documents." }, { status: 403 })
  }
  await pool.query(`delete from public.employee_documents where id = $1`, [r.docId])
  await deleteEmployeeDocument(r.doc.storage_path).catch(() => {})
  await recordEmployeeHistory(pool, [
    { employeeId: r.id, actorId: r.caller.id, action: "Document deleted", field: r.doc.category, before: r.doc.title },
  ])
  return NextResponse.json({ ok: true })
}

import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import { DOCUMENT_CATEGORIES } from "@/lib/hr/constants"
import { canManageHr, recordEmployeeHistory } from "@/lib/hr/server"
import { deleteEmployeeDocument, uploadEmployeeDocument } from "@/lib/storage"

/** Upload a document for an employee — by HR, or by the employee themselves. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { id } = await params
  if (caller.id !== id && !canManageHr(caller.role)) {
    return NextResponse.json({ error: "You can only upload your own documents." }, { status: 403 })
  }

  const form = await request.formData()
  const file = form.get("file")
  const category = String(form.get("category") ?? "Other")
  const title = String(form.get("title") ?? "").trim()

  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 })
  if (!(DOCUMENT_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "Document type is invalid." }, { status: 400 })
  }

  const { rows: exists } = await pool.query(`select 1 from public.employees where id = $1`, [id])
  if (!exists[0]) return NextResponse.json({ error: "Employee not found." }, { status: 404 })

  let path: string
  try {
    path = await uploadEmployeeDocument(id, file)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 })
  }

  try {
    const { rows } = await pool.query<{ id: string; created_at: string }>(
      `insert into public.employee_documents
         (employee_id, category, title, storage_path, file_name, content_type, size_bytes, uploaded_by_employee_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, to_json(created_at)#>>'{}' as created_at`,
      [id, category, title || file.name, path, file.name, file.type, file.size, caller.id]
    )
    await recordEmployeeHistory(pool, [
      { employeeId: id, actorId: caller.id, action: "Document uploaded", field: category, after: title || file.name },
    ])
    return NextResponse.json(
      {
        document: {
          id: rows[0].id,
          category,
          title: title || file.name,
          fileName: file.name,
          sizeBytes: file.size,
          uploadedBy: caller.name,
          createdAt: rows[0].created_at,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    await deleteEmployeeDocument(path).catch(() => {})
    logError("employees.documents.create", error, { employeeId: id })
    return NextResponse.json({ error: "Could not save the document. Please try again." }, { status: 500 })
  }
}

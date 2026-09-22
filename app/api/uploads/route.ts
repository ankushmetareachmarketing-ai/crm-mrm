import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { uploadImage, type UploadKind } from "@/lib/storage"

const VALID_KINDS: UploadKind[] = ["client-logos", "employee-photos"]

export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  const kind = formData.get("kind")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 })
  }
  if (typeof kind !== "string" || !VALID_KINDS.includes(kind as UploadKind)) {
    return NextResponse.json({ error: "Invalid upload kind." }, { status: 400 })
  }

  try {
    const url = await uploadImage(kind as UploadKind, file)
    return NextResponse.json({ url }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

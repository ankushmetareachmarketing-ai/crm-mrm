import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"

export async function POST(request: Request) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  if (caller.role !== "Owner") {
    return NextResponse.json({ error: "Only the Owner can add access profiles." }, { status: 403 })
  }

  const body = await request.json()
  const { name, description, dataScope } = body ?? {}

  if (!name || !description || !dataScope) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 })
  }

  try {
    const { rows } = await pool.query(
      `insert into public.access_profiles (name, description, data_scope)
       values ($1, $2, $3)
       returning id, name, description, data_scope`,
      [name, description, dataScope]
    )
    return NextResponse.json({ profile: rows[0] }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "A profile with that name already exists." }, { status: 400 })
  }
}

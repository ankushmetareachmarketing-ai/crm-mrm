import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import { canManageHr } from "@/lib/hr/server"
import { ORG_KINDS, ORG_LABEL, parseOrgBody, type OrgKind } from "@/lib/hr/org"

/** Creates a department, designation or team. */
export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  if (!canManageHr(caller.role)) return NextResponse.json({ error: "Only HR or the Owner can do this." }, { status: 403 })

  const { kind } = await params
  if (!ORG_KINDS.includes(kind as OrgKind)) return NextResponse.json({ error: "Not found." }, { status: 404 })

  const parsed = parseOrgBody(kind as OrgKind, (await request.json()) ?? {}, true)
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const columns = Object.keys(parsed.values)
  try {
    const { rows } = await pool.query<{ id: string }>(
      `insert into public.${kind} (${columns.join(", ")})
       values (${columns.map((_, i) => `$${i + 1}`).join(", ")})
       returning id`,
      Object.values(parsed.values)
    )
    return NextResponse.json({ id: rows[0].id }, { status: 201 })
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: `A ${ORG_LABEL[kind as OrgKind].toLowerCase()} with that name already exists.` }, { status: 400 })
    }
    logError("hr.org.create", error, { kind })
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 })
  }
}

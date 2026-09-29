import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { pool } from "@/lib/db"
import { logError } from "@/lib/logger"
import { canManageHr } from "@/lib/hr/server"
import { ORG_KINDS, ORG_LABEL, parseOrgBody, type OrgKind } from "@/lib/hr/org"

async function guard(params: Promise<{ kind: string; id: string }>) {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) return { response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) }
  if (!canManageHr(caller.role)) {
    return { response: NextResponse.json({ error: "Only HR or the Owner can do this." }, { status: 403 }) }
  }
  const { kind, id } = await params
  if (!ORG_KINDS.includes(kind as OrgKind) || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { response: NextResponse.json({ error: "Not found." }, { status: 404 }) }
  }
  return { kind: kind as OrgKind, id }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const g = await guard(params)
  if ("response" in g) return g.response

  const parsed = parseOrgBody(g.kind, (await request.json()) ?? {}, false)
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const columns = Object.keys(parsed.values)
  if (columns.length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 })

  try {
    const { rowCount } = await pool.query(
      `update public.${g.kind} set ${columns.map((c, i) => `${c} = $${i + 1}`).join(", ")}
       where id = $${columns.length + 1}`,
      [...Object.values(parsed.values), g.id]
    )
    if (!rowCount) return NextResponse.json({ error: "Not found." }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: `A ${ORG_LABEL[g.kind].toLowerCase()} with that name already exists.` }, { status: 400 })
    }
    logError("hr.org.update", error, { kind: g.kind })
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 })
  }
}

/** Deleting leaves employees in place; their department/designation/team is just cleared. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const g = await guard(params)
  if ("response" in g) return g.response
  await pool.query(`delete from public.${g.kind} where id = $1`, [g.id])
  return NextResponse.json({ ok: true })
}

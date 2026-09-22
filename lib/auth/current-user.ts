import "server-only"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getInitials } from "@/lib/format"
import type { Role } from "@/lib/types"

export interface CurrentEmployee {
  id: string
  name: string
  initials: string
  loginId: string
  role: Role
}

/** Reads the signed-in employee from the session, or null if there isn't one. Safe to call from Route Handlers. */
export async function getCurrentEmployeeOrNull(): Promise<CurrentEmployee | null> {
  const session = await auth()
  if (!session?.user) return null

  return {
    id: session.user.id,
    name: session.user.name,
    initials: getInitials(session.user.name),
    loginId: session.user.loginId,
    role: session.user.role,
  }
}

/** Reads the signed-in employee, redirecting to /login if there isn't one. Server Components/Actions only. */
export async function getCurrentEmployee(): Promise<CurrentEmployee> {
  const employee = await getCurrentEmployeeOrNull()
  if (!employee) redirect("/login")
  return employee
}

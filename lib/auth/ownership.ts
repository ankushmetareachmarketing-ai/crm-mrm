import type { CurrentEmployee } from "@/lib/auth/current-user"

export class ForbiddenError extends Error {
  constructor(message = "You don't have access to this record.") {
    super(message)
    this.name = "ForbiddenError"
  }
}

/**
 * Central ownership rule for Leads/Clients: the Owner role can act on any
 * record; every other role only on records they own. Never trust an
 * `ownerEmployeeId` sent from the browser — always resolve the record's
 * current owner from the database and compare against the session's id.
 */
export function assertOwnsOrIsOwner(caller: CurrentEmployee, resourceOwnerEmployeeId: string | null) {
  if (caller.role === "Owner") return
  if (resourceOwnerEmployeeId && resourceOwnerEmployeeId === caller.id) return
  throw new ForbiddenError()
}

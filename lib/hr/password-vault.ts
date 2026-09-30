import "server-only"
import type { PoolClient } from "pg"
import { encryptSecret } from "@/lib/crypto"
import { pool } from "@/lib/db"

/**
 * Keeps an encrypted copy of a newly set login password so the Owner can
 * look it up later (see 20261001000000_password_vault.sql). Call it
 * wherever a password is set; login itself keeps using the bcrypt hash.
 */
export async function storePasswordInVault(
  db: PoolClient | typeof pool,
  employeeId: string,
  plainPassword: string,
  setById: string | null
) {
  await db.query(
    `insert into public.employee_password_vault (employee_id, value_encrypted, set_by_employee_id)
     values ($1, $2, $3)`,
    [employeeId, encryptSecret(plainPassword), setById]
  )
}

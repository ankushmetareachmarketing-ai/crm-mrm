import "server-only"
import { randomBytes, createHash } from "crypto"

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

export function generateResetToken() {
  const token = randomBytes(32).toString("hex")
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
  return { token, tokenHash, expiresAt }
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

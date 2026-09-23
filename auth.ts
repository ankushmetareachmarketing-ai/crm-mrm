import NextAuth from "next-auth"
import { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { pool } from "@/lib/db"
import { verifyPassword } from "@/lib/auth/password"
import type { Role } from "@/lib/types"

interface EmployeeAuthRow {
  id: string
  name: string
  login_id: string
  password_hash: string
  active: boolean
  role: Role
  failed_login_attempts: number
  locked_until: string | null
}

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

// Distinct error `type` so lib/auth/actions.ts can show a specific message
// instead of the generic "invalid credentials" one — thrown from
// authorize() (a server action context), so NextAuth surfaces it as-is
// rather than redirecting.
export class AccountLockedError extends CredentialsSignin {
  static type = "AccountLockedError"
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        loginId: { label: "Login ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const loginId = String(credentials?.loginId ?? "").trim()
        const password = String(credentials?.password ?? "")
        if (!loginId || !password) return null

        const { rows } = await pool.query<EmployeeAuthRow>(
          `select e.id, e.name, e.login_id, e.password_hash, e.active, p.name as role,
                  e.failed_login_attempts, e.locked_until::text
           from public.employees e
           join public.access_profiles p on p.id = e.access_profile_id
           where e.login_id = $1`,
          [loginId]
        )
        const employee = rows[0]
        if (!employee || !employee.active) return null

        if (employee.locked_until && new Date(employee.locked_until) > new Date()) {
          const minutesLeft = Math.ceil((new Date(employee.locked_until).getTime() - Date.now()) / 60_000)
          throw new AccountLockedError(`Too many failed attempts. Try again in ${minutesLeft} minute(s).`)
        }

        const valid = await verifyPassword(password, employee.password_hash)
        if (!valid) {
          const attempts = employee.failed_login_attempts + 1
          const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? `now() + interval '${LOCKOUT_MINUTES} minutes'` : "null"
          await pool.query(
            `update public.employees set failed_login_attempts = $1, locked_until = ${lockedUntil} where id = $2`,
            [attempts, employee.id]
          )
          return null
        }

        if (employee.failed_login_attempts > 0 || employee.locked_until) {
          await pool.query(
            `update public.employees set failed_login_attempts = 0, locked_until = null where id = $1`,
            [employee.id]
          )
        }

        return {
          id: employee.id,
          name: employee.name,
          loginId: employee.login_id,
          role: employee.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!
        token.loginId = user.loginId
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.loginId = token.loginId as string
      session.user.role = token.role as Role
      return session
    },
  },
})

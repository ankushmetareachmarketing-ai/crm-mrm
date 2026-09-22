import NextAuth from "next-auth"
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
          `select e.id, e.name, e.login_id, e.password_hash, e.active, p.name as role
           from public.employees e
           join public.access_profiles p on p.id = e.access_profile_id
           where e.login_id = $1`,
          [loginId]
        )
        const employee = rows[0]
        if (!employee || !employee.active) return null

        const valid = await verifyPassword(password, employee.password_hash)
        if (!valid) return null

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

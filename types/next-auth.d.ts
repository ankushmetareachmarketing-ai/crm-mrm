import type { Role } from "@/lib/types"

declare module "next-auth" {
  interface User {
    loginId: string
    role: Role
  }

  interface Session {
    user: {
      id: string
      name: string
      loginId: string
      role: Role
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    loginId: string
    role: Role
  }
}

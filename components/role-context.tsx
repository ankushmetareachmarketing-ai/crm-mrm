"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { Role } from "@/lib/types"

export interface CurrentUser {
  id: string
  name: string
  initials: string
  loginId: string
  role: Role
}

interface RoleContextValue {
  role: Role
  user: CurrentUser
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({
  user,
  children,
}: {
  user: CurrentUser
  children: ReactNode
}) {
  return (
    <RoleContext.Provider value={{ role: user.role, user }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error("useRole must be used within a RoleProvider")
  return ctx
}

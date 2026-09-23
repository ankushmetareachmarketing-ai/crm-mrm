"use server"

import { AuthError } from "next-auth"
import { signIn, signOut, AccountLockedError } from "@/auth"

export type LoginState = { error: string } | undefined

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      loginId: formData.get("loginId"),
      password: formData.get("password"),
      redirectTo: "/",
    })
  } catch (error) {
    if (error instanceof AccountLockedError) {
      return { error: "Too many failed attempts. Please wait a few minutes and try again." }
    }
    if (error instanceof AuthError) {
      return { error: "Invalid login ID or password." }
    }
    throw error
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" })
}

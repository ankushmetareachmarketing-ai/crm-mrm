"use client"

import { useActionState } from "react"
import Link from "next/link"
import { login } from "@/lib/auth/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined)

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 bg-[url('/images/user-bg.png')] bg-cover bg-center bg-no-repeat p-4 md:justify-end md:pr-16 lg:pr-32">
      <Card className="w-full max-w-md gap-6 rounded-3xl border-white/60 bg-white/90 py-8 shadow-2xl backdrop-blur-sm">
        <CardHeader className="px-8">
          <CardTitle className="text-3xl font-bold tracking-tight">
            MetaReach Office
          </CardTitle>
          <CardDescription className="text-base font-medium">
            Sign in with the login ID and password your admin gave you.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8">
          <form action={formAction} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="loginId" className="text-sm font-semibold">
                Login ID
              </Label>
              <Input
                id="loginId"
                name="loginId"
                placeholder="e.g. ravi.owner"
                autoFocus
                required
                className="h-12 rounded-xl px-4 text-base font-medium md:text-base"
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-semibold">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                required
                className="h-12 rounded-xl px-4 text-base font-medium md:text-base"
              />
            </div>
            {state?.error ? (
              <p className="text-sm font-medium text-destructive">{state.error}</p>
            ) : null}
            <Button
              type="submit"
              disabled={pending}
              className="mt-1 h-12 w-full cursor-pointer rounded-xl text-base font-semibold disabled:cursor-not-allowed"
            >
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function ForgotPasswordPage() {
  const [loginId, setLoginId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetUrl, setResetUrl] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? "Something went wrong.")
        return
      }
      setResetUrl(body.resetUrl ?? null)
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Enter your login ID and we&apos;ll start a password reset.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {done ? (
            <>
              <Alert>
                <AlertTitle>Request received</AlertTitle>
                <AlertDescription>
                  If that login ID exists, a reset link has been created.
                </AlertDescription>
              </Alert>
              {resetUrl ? (
                <Alert>
                  <AlertTitle>No company email is configured yet</AlertTitle>
                  <AlertDescription>
                    Until email is set up, here&apos;s your reset link directly:{" "}
                    <Link href={resetUrl} className="font-medium underline">
                      Reset password
                    </Link>
                  </AlertDescription>
                </Alert>
              ) : null}
              <Link href="/login" className="text-sm text-muted-foreground underline">
                Back to sign in
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="loginId">Login ID</Label>
                <Input
                  id="loginId"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="e.g. ravi.owner"
                  autoFocus
                  required
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Sending…" : "Send reset link"}
              </Button>
              <Link href="/login" className="text-center text-sm text-muted-foreground underline">
                Back to sign in
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

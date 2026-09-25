"use client"

import Link from "next/link"
import { useEffect } from "react"
import { AlertTriangle } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: "error",
        context: "dashboard-error-boundary",
        message: error.message,
        digest: error.digest,
        time: new Date().toISOString(),
      })
    )
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>
              This page ran into an error loading its data. Your other pages are unaffected.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
            Go to dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

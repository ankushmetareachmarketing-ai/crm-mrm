"use client"

import { useEffect } from "react"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: "error",
        context: "root-error-boundary",
        message: error.message,
        digest: error.digest,
        time: new Date().toISOString(),
      })
    )
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center p-4 font-sans">
        <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg border p-6 text-center">
          <h1 className="text-lg font-semibold">MetaReach Office is unavailable</h1>
          <p className="text-sm text-muted-foreground">
            Something went wrong loading the application. Please try again in a moment.
          </p>
          <button
            onClick={() => reset()}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}

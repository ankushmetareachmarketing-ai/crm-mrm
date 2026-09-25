import "server-only"
import { notFound } from "next/navigation"

/**
 * Modules that still run on mock data (lib/mock-data.ts) are switched off
 * for go-live: their route layout calls this, so a direct URL 404s instead
 * of showing made-up numbers. Remove a route's layout.tsx to turn it back on
 * once it reads real data.
 */
export function disabledModule(): never {
  notFound()
}

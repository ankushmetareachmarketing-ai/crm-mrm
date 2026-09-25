import { NextResponse } from "next/server"
import { getCurrentEmployeeOrNull } from "@/lib/auth/current-user"
import { isRealtimeConfigured, mintRealtimeToken, notificationTopic } from "@/lib/realtime"

/**
 * Credentials for the header bell to listen for live notification pings.
 * Returns { enabled: false } when Realtime keys aren't configured, so the
 * bell falls back to polling.
 */
export async function GET() {
  const caller = await getCurrentEmployeeOrNull()
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  if (!isRealtimeConfigured()) {
    return NextResponse.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } })
  }

  const { token, expiresAt } = mintRealtimeToken(caller.id)
  return NextResponse.json(
    {
      enabled: true,
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      token,
      expiresAt,
      topic: notificationTopic(caller.id),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}

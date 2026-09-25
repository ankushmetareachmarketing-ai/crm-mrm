"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Bell,
  Building2,
  CheckCircle2,
  IndianRupee,
  Layers,
  Users,
  type IconComponent,
} from "@/components/icons"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

interface NotificationRow {
  id: string
  title: string
  detail: string
  kind: string | null
  link: string | null
  created_at: string
  read_at: string | null
  actor_name: string | null
}

/** How often the bell checks for new notifications while the tab is visible. */
const POLL_MS = 10_000
/** When live pings are connected, polling is only a safety net. */
const LIVE_POLL_MS = 60_000

interface RealtimeCredentials {
  enabled: boolean
  url?: string
  anonKey?: string
  token?: string
  expiresAt?: number
  topic?: string
}

async function fetchRealtimeCredentials(): Promise<RealtimeCredentials> {
  try {
    const res = await fetch("/api/realtime-token", { cache: "no-store" })
    return res.ok ? await res.json() : { enabled: false }
  } catch {
    return { enabled: false }
  }
}

/**
 * Subscribes to this employee's private Supabase Realtime channel and calls
 * onPing whenever a new notification is saved for them. Returns whether the
 * live connection is up. Does nothing (returns false) if Realtime isn't
 * configured on the server.
 */
function useNotificationPings(onPing: () => void) {
  const [live, setLive] = useState(false)
  const onPingRef = useRef(onPing)
  useEffect(() => {
    onPingRef.current = onPing
  }, [onPing])

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | undefined

    void (async () => {
      const creds = await fetchRealtimeCredentials()
      if (cancelled || !creds.enabled || !creds.url || !creds.anonKey || !creds.token || !creds.topic) return

      // Loaded only when Realtime is on, so the library stays out of the bundle otherwise.
      const { createClient } = await import("@supabase/supabase-js")
      if (cancelled) return
      const supabase = createClient(creds.url, creds.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
      await supabase.realtime.setAuth(creds.token)

      const channel = supabase
        .channel(creds.topic, { config: { private: true } })
        .on("broadcast", { event: "new" }, () => onPingRef.current())
        .subscribe((status) => setLive(status === "SUBSCRIBED"))

      // The token lasts an hour; swap in a fresh one a few minutes early.
      let refreshTimer: number | undefined
      const scheduleRefresh = (expiresAt: number) => {
        const ms = Math.max(expiresAt * 1000 - Date.now() - 5 * 60_000, 30_000)
        refreshTimer = window.setTimeout(async () => {
          const next = await fetchRealtimeCredentials()
          if (next.enabled && next.token && next.expiresAt) {
            await supabase.realtime.setAuth(next.token)
            scheduleRefresh(next.expiresAt)
          }
        }, ms)
      }
      scheduleRefresh(creds.expiresAt ?? Math.floor(Date.now() / 1000) + 3600)

      cleanup = () => {
        window.clearTimeout(refreshTimer)
        void supabase.removeChannel(channel)
        supabase.realtime.disconnect()
      }
      if (cancelled) cleanup()
    })()

    return () => {
      cancelled = true
      cleanup?.()
      setLive(false)
    }
  }, [])

  return live
}

const KIND_STYLE: Record<string, { icon: IconComponent; tone: string }> = {
  service: { icon: Layers, tone: "bg-sky-100 text-sky-700" },
  payment: { icon: IndianRupee, tone: "bg-violet-100 text-violet-700" },
  approval: { icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700" },
  lead: { icon: Users, tone: "bg-amber-100 text-amber-700" },
  client: { icon: Building2, tone: "bg-primary/10 text-primary" },
  employee: { icon: Users, tone: "bg-slate-100 text-slate-700" },
}

export function NotificationBell() {
  const router = useRouter()
  const pathname = usePathname()
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [unread, setUnread] = useState(0)
  const [bump, setBump] = useState(false)
  const lastUnread = useRef<number | null>(null)
  const pathnameRef = useRef(pathname)
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" })
      if (!res.ok) return
      const body: { notifications: NotificationRow[]; unread: number } = await res.json()
      const previous = lastUnread.current
      setNotifications(body.notifications ?? [])
      setUnread(body.unread ?? 0)
      lastUnread.current = body.unread ?? 0

      if (previous !== null && body.unread > previous) {
        // Something new arrived: wiggle the bell, and if it is about the page
        // being looked at, refresh that page's data so it shows up too.
        setBump(true)
        window.setTimeout(() => setBump(false), 1200)
        const fresh = body.notifications.slice(0, body.unread - previous)
        if (fresh.some((n) => n.link && n.link.split("?")[0] === pathnameRef.current)) {
          router.refresh()
        }
      }
    } catch {
      // Offline or a server hiccup — the next poll tries again.
    }
  }, [router])

  // A live ping means "something new for you" — fetch it straight away.
  const live = useNotificationPings(() => void load())

  // Check now (and again on every page change), then on a timer while the
  // tab is visible, and straight away when the user comes back to it.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void load()
    }
    const first = window.setTimeout(tick, 0)
    const timer = window.setInterval(tick, live ? LIVE_POLL_MS : POLL_MS)
    document.addEventListener("visibilitychange", tick)
    window.addEventListener("focus", tick)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", tick)
      window.removeEventListener("focus", tick)
    }
  }, [pathname, load, live])

  function openNotification(n: NotificationRow) {
    if (!n.read_at) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      setUnread((u) => Math.max(u - 1, 0))
      lastUnread.current = Math.max((lastUnread.current ?? 1) - 1, 0)
      void fetch(`/api/notifications/${n.id}`, { method: "PATCH" }).catch(() => {})
    }
    if (n.link) router.push(n.link)
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })))
    setUnread(0)
    lastUnread.current = 0
    await fetch("/api/notifications", { method: "PATCH" }).catch(() => {})
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && void load()}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="relative size-10 cursor-pointer rounded-xl"
            aria-label={unread > 0 ? `${unread} new notifications` : "Notifications"}
          />
        }
      >
        <Bell className={cn("size-5", bump && "animate-bounce")} />
        {unread > 0 ? (
          <span
            className={cn(
              "absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white ring-2 ring-background",
              bump && "animate-pulse"
            )}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {live ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700" title="New notifications arrive instantly">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Live
                </span>
              ) : null}
              {live ? "·" : null} {unread > 0 ? `${unread} new` : "You're all caught up"}
            </p>
          </div>
          {unread > 0 ? (
            <Button variant="ghost" size="sm" className="cursor-pointer text-xs" onClick={() => void markAllRead()}>
              Mark all as read
            </Button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuGroup className="max-h-[26rem] overflow-y-auto p-1">
          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium">No notifications yet</p>
              <p className="text-xs text-muted-foreground">New services, payments and approvals will show up here.</p>
            </div>
          ) : (
            notifications.map((n) => {
              const style = KIND_STYLE[n.kind ?? ""] ?? KIND_STYLE.employee
              const Icon = style.icon
              const isUnread = !n.read_at
              return (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 whitespace-normal",
                    isUnread && "bg-primary/5"
                  )}
                >
                  <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", style.tone)}>
                    <Icon className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={cn("text-sm", isUnread ? "font-semibold" : "font-medium text-foreground/80")}>
                      {n.title}
                    </span>
                    <span className="text-xs text-muted-foreground">{n.detail}</span>
                    <span className="text-[11px] text-muted-foreground">{formatRelativeTime(n.created_at)}</span>
                  </span>
                  {isUnread ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="New" /> : null}
                </DropdownMenuItem>
              )
            })
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

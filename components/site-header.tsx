"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Bell, Search } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useRole } from "@/components/role-context"
import { logout } from "@/lib/auth/actions"
import { navGroups } from "@/lib/nav"
import { formatRelativeTime } from "@/lib/format"

interface NotificationRow {
  id: string
  title: string
  detail: string
  created_at: string
  read_at: string | null
}

export function SiteHeader() {
  const pathname = usePathname()
  const { user } = useRole()
  const [notifications, setNotifications] = useState<NotificationRow[]>([])

  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((body) => setNotifications(body.notifications ?? []))
      .catch(() => {})
  }, [])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  function handleNotificationsOpenChange(open: boolean) {
    if (open && unreadCount > 0) {
      fetch("/api/notifications", { method: "PATCH" })
        .then(() => setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))))
        .catch(() => {})
    }
  }

  const allItems = navGroups.flatMap((g) => g.items)
  const bestMatch = allItems
    .filter((item) => item.url === "/" ? pathname === "/" : pathname.startsWith(item.url))
    .sort((a, b) => b.url.length - a.url.length)[0]
  const pageTitle = bestMatch?.title ?? "MetaReach Office"

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <h1 className="text-sm font-medium">{pageTitle}</h1>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search clients, campaigns…" className="h-8 w-56 pl-8" />
        </div>

        <DropdownMenu onOpenChange={handleNotificationsOpenChange}>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="relative" />}>
            <Bell className="size-5" />
            {unreadCount > 0 ? (
              <Badge className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
                {unreadCount}
              </Badge>
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Owner inbox</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">No notifications.</div>
              ) : (
                notifications.map((n) => (
                  <DropdownMenuItem key={n.id} className="flex-col items-start gap-0.5 whitespace-normal">
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="text-xs text-muted-foreground">{n.detail}</span>
                    <span className="text-[11px] text-muted-foreground">{formatRelativeTime(n.created_at)}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" />}>
            <Avatar className="size-7">
              <AvatarFallback>{user.initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">{user.role}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void logout()}>Log out</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

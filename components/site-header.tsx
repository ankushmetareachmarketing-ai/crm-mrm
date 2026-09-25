"use client"

import { usePathname } from "next/navigation"
import { NotificationBell } from "@/components/notification-bell"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
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
import { useRole } from "@/components/role-context"
import { logout } from "@/lib/auth/actions"
import { navGroups } from "@/lib/nav"

export function SiteHeader() {
  const pathname = usePathname()
  const { user } = useRole()

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
        <NotificationBell />

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

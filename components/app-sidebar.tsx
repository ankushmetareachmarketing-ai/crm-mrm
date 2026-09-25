"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { navGroups } from "@/lib/nav"
import { useRole } from "@/components/role-context"
import { cn } from "@/lib/utils"

/** A section stays highlighted on its sub-pages (e.g. /services/new). Links with a query string (tabs) never auto-highlight. */
function isActivePath(pathname: string, url: string) {
  if (url.includes("?")) return false
  if (url === "/") return pathname === "/"
  return pathname === url || pathname.startsWith(`${url}/`)
}

export function AppSidebar() {
  const pathname = usePathname()
  const { role, user } = useRole()

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b px-4 pt-5 pb-4 group-data-[collapsible=icon]:px-2">
        <Link
          href="/"
          className="flex rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          {/* Full logo when open; only the "MR" mark (left 60px of the 240×60 image) when collapsed. */}
          <span className="block overflow-hidden group-data-[collapsible=icon]:w-8">
            <Image
              src="/images/logo-dark.png"
              alt="MetaReach"
              width={240}
              height={60}
              priority
              className="h-11 w-auto max-w-none object-contain object-left group-data-[collapsible=icon]:h-8"
            />
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-1 py-3">
        {navGroups.map((group) => {
          const items = group.items.filter((item) => item.roles === "all" || item.roles.includes(role))
          if (items.length === 0) return null
          return (
            <SidebarGroup key={group.label} className="px-3 py-1.5">
              <SidebarGroupLabel className="h-9 px-3 text-xs font-bold tracking-wider text-sidebar-foreground/55 uppercase">
                {group.label}
              </SidebarGroupLabel>
              <SidebarMenu className="gap-1">
                {items.map((item) => {
                  const active = isActivePath(pathname, item.url)
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        render={<Link href={item.url} />}
                        isActive={active}
                        tooltip={item.title}
                        className={cn(
                          "relative h-11 cursor-pointer gap-3 rounded-xl px-3 text-[15px] font-medium text-sidebar-foreground/80 [&_svg]:size-5",
                          "hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                          "data-active:bg-primary/10 data-active:font-semibold data-active:text-primary",
                          active &&
                            "before:absolute before:top-2 before:bottom-2 before:left-0 before:w-1 before:rounded-full before:bg-primary group-data-[collapsible=icon]:before:hidden"
                        )}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter className="border-t p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="h-14 gap-3 rounded-xl bg-sidebar-accent/50 px-3 hover:bg-sidebar-accent"
            >
              <Avatar className="size-9 rounded-xl group-data-[collapsible=icon]:size-8">
                <AvatarFallback className="rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                  {user.initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-[15px] font-semibold">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{role}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

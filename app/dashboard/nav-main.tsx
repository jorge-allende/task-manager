"use client"

import { type Icon } from "@tabler/icons-react"
import { usePathname, useRouter } from "next/navigation"
import { useOptimistic, useTransition } from "react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
  }[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [optimisticPath, setOptimisticPath] = useOptimistic(pathname)
  const [isPending, startTransition] = useTransition()

  const handleNavigation = (url: string) => {
    startTransition(() => {
      setOptimisticPath(url)
      router.push(url)
    })
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2" data-pending={isPending ? "" : undefined}>
        {/* Main navigation items */}
        <SidebarMenu>
          {items.map((item) => {
            // Use optimistic path for instant feedback
            const isActive = optimisticPath === item.url || (optimisticPath === '/dashboard' && item.url === '/dashboard')
            
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  tooltip={item.title}
                  isActive={isActive}
                  onClick={() => handleNavigation(item.url)}
                >
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

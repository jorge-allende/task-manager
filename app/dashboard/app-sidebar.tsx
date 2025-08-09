"use client"

import * as React from "react"
import {
  IconLayoutBoard,
  IconCalendar,
  IconListDetails,
  IconPlus,
  IconChevronDown,
  IconHelp,
  IconSearch,
  IconSettings,
  IconSparkles,
} from "@tabler/icons-react"

import { NavMain } from "@/app/dashboard/nav-main"
import { NavSecondary } from "@/app/dashboard/nav-secondary"
import { NavUser } from "@/app/dashboard/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ChatMaxingIconColoured } from "@/components/logo"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useWorkspace } from "@/components/providers/workspace-provider"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"

const data = {
  navMain: [
    {
      title: "Board",
      url: "/dashboard/board",
      icon: IconLayoutBoard,
    },
    {
      title: "Calendar",
      url: "/dashboard/calendar",
      icon: IconCalendar,
    },
    {
      title: "All Tasks",
      url: "/dashboard/tasks",
      icon: IconListDetails,
    },
    {
      title: "Payment gated",
      url: "/dashboard/payment-gated",
      icon: IconSparkles,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: IconSettings,
    },
    {
      title: "Get Help",
      url: "/dashboard/help",
      icon: IconHelp,
    },
    {
      title: "Search",
      url: "/dashboard/search",
      icon: IconSearch,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { 
    currentWorkspace, 
    workspaces, 
    switchWorkspace, 
    createWorkspace,
    isLoading 
  } = useWorkspace()
  const router = useRouter()
  const [isCreatingWorkspace, setIsCreatingWorkspace] = React.useState(false)

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/dashboard">
                <IconLayoutBoard className="!size-6" />
                <span className="text-base font-semibold">Kanban Board</span>
                <Badge variant="outline" className="text-muted-foreground text-xs">v2</Badge>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        {/* Workspace Switcher */}
        <div className="mt-3 px-3">
          {isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  size="sm"
                >
                  <span className="truncate">
                    {currentWorkspace?.name || "Select Workspace"}
                  </span>
                  <IconChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px]" align="start">
                <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {workspaces && workspaces.length > 0 ? (
                  workspaces.map((workspace) => (
                    <DropdownMenuItem 
                      key={workspace._id}
                      onClick={() => switchWorkspace(workspace._id)}
                      className={currentWorkspace?._id === workspace._id ? "bg-accent" : ""}
                    >
                      {workspace.name}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>
                    No workspaces available
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={async () => {
                    const name = prompt("Enter workspace name:")
                    if (name) {
                      try {
                        setIsCreatingWorkspace(true)
                        const workspaceId = await createWorkspace(name)
                        await switchWorkspace(workspaceId)
                      } catch (error) {
                        console.error("Failed to create workspace:", error)
                      } finally {
                        setIsCreatingWorkspace(false)
                      }
                    }
                  }}
                  disabled={isCreatingWorkspace}
                >
                  <IconPlus className="mr-2 h-4 w-4" />
                  {isCreatingWorkspace ? "Creating..." : "Create Workspace"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}

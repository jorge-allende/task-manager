"use client"

import * as React from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Link } from "lucide-react"
import { cn } from "@/lib/utils"
import { LinkInput, TaskLink } from "./link-input"
import { useToast } from "@/hooks/use-toast"

interface LinksSectionProps {
  taskId: Id<"tasks">
  currentLinks?: TaskLink[]
  onUpdate?: (links: TaskLink[]) => void
  className?: string
}

export function LinksSection({
  taskId,
  currentLinks = [],
  onUpdate,
  className,
}: LinksSectionProps) {
  const { toast } = useToast()
  const updateLinks = useMutation(api.tasks.updateLinks)

  const handleLinksChange = async (newLinks: TaskLink[]) => {
    try {
      // Update in database
      await updateLinks({
        taskId,
        links: newLinks,
      })

      // Call parent update handler
      if (onUpdate) {
        onUpdate(newLinks)
      }

      toast({
        title: "Success",
        description: "Links updated successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update links",
        variant: "destructive",
      })
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Link className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium">Links</h3>
        {currentLinks.length > 0 && (
          <span className="text-sm text-muted-foreground">
            ({currentLinks.length})
          </span>
        )}
      </div>

      <LinkInput
        value={currentLinks}
        onChange={handleLinksChange}
        maxLinks={10}
      />
    </div>
  )
}
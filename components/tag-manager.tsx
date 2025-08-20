"use client"

import * as React from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Edit2, MoreVertical, Trash2, Tag, Plus } from "lucide-react"
import { getTagColor } from "@/components/kanban/kanban-card"

interface TagManagerProps {
  workspaceId: Id<"workspaces">
  isOpen: boolean
  onClose: () => void
}

const predefinedColors = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Yellow", value: "#eab308" },
  { name: "Lime", value: "#84cc16" },
  { name: "Green", value: "#22c55e" },
  { name: "Emerald", value: "#10b981" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Fuchsia", value: "#d946ef" },
  { name: "Pink", value: "#ec4899" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Gray", value: "#6b7280" },
]

export function TagManager({ workspaceId, isOpen, onClose }: TagManagerProps) {
  const { toast } = useToast()
  const [isCreating, setIsCreating] = React.useState(false)
  const [editingTag, setEditingTag] = React.useState<string | null>(null)
  const [newTagName, setNewTagName] = React.useState("")
  const [newTagColor, setNewTagColor] = React.useState("#3b82f6")
  const [editName, setEditName] = React.useState("")
  const [editColor, setEditColor] = React.useState("")

  const tags = useQuery(api.tags.getTags, { workspaceId })
  const tagStats = useQuery(api.tags.getTagStats, { workspaceId })
  const createTag = useMutation(api.tags.createTag)
  const updateTag = useMutation(api.tags.updateTag)
  const deleteTag = useMutation(api.tags.deleteTag)

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return

    try {
      await createTag({
        workspaceId,
        name: newTagName.trim(),
        color: newTagColor,
      })
      toast({
        title: "Tag created",
        description: `Tag "${newTagName}" has been created successfully.`,
      })
      setNewTagName("")
      setNewTagColor("#3b82f6")
      setIsCreating(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create tag",
        variant: "destructive",
      })
    }
  }

  const handleUpdateTag = async (tagId: Id<"workspaceTags">) => {
    if (!editName.trim()) return

    try {
      await updateTag({
        id: tagId,
        name: editName.trim(),
        color: editColor,
      })
      toast({
        title: "Tag updated",
        description: "Tag has been updated successfully.",
      })
      setEditingTag(null)
      setEditName("")
      setEditColor("")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update tag",
        variant: "destructive",
      })
    }
  }

  const handleDeleteTag = async (tagId: Id<"workspaceTags">, tagName: string) => {
    try {
      await deleteTag({ id: tagId })
      toast({
        title: "Tag deleted",
        description: `Tag "${tagName}" has been deleted and removed from all tasks.`,
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tag",
        variant: "destructive",
      })
    }
  }

  const startEdit = (tag: any) => {
    setEditingTag(tag._id)
    setEditName(tag.name)
    setEditColor(tag.color)
  }

  const cancelEdit = () => {
    setEditingTag(null)
    setEditName("")
    setEditColor("")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription>
            Create and manage tags for organizing tasks in your workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new tag */}
          {!isCreating ? (
            <Button
              onClick={() => setIsCreating(true)}
              variant="outline"
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Tag
            </Button>
          ) : (
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="new-tag-name">Tag Name</Label>
                <Input
                  id="new-tag-name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Enter tag name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateTag()
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {predefinedColors.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setNewTagColor(color.value)}
                      className={cn(
                        "w-8 h-8 rounded-md border-2 transition-all",
                        newTagColor === color.value
                          ? "border-primary scale-110"
                          : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-muted-foreground">Preview:</span>
                  <Badge
                    style={{
                      backgroundColor: newTagColor,
                      color: "white",
                    }}
                  >
                    {newTagName || "Tag Name"}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                >
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false)
                    setNewTagName("")
                    setNewTagColor("#3b82f6")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Existing tags */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Existing Tags</h3>
            <ScrollArea className="h-[300px] w-full">
              <div className="space-y-2">
                {tags?.map((tag) => {
                  const stats = tagStats?.find((s) => s._id === tag._id)
                  const isEditing = editingTag === tag._id
                  const { bg, text } = getTagColor(tag.name, tag.color)

                  return (
                    <div
                      key={tag._id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 w-32"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleUpdateTag(tag._id)
                              } else if (e.key === "Escape") {
                                cancelEdit()
                              }
                            }}
                          />
                          <div className="flex gap-1">
                            {predefinedColors.slice(0, 8).map((color) => (
                              <button
                                key={color.value}
                                onClick={() => setEditColor(color.value)}
                                className={cn(
                                  "w-6 h-6 rounded border-2 transition-all",
                                  editColor === color.value
                                    ? "border-primary scale-110"
                                    : "border-transparent hover:scale-105"
                                )}
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                              />
                            ))}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleUpdateTag(tag._id)}
                            disabled={!editName.trim()}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <Badge className={cn(bg, text)}>
                              {tag.name}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {stats?.taskCount || 0} tasks
                            </span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => startEdit(tag)}>
                                <Edit2 className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteTag(tag._id, tag.name)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>
                  )
                })}
                {(!tags || tags.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No tags created yet. Create your first tag to get started.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
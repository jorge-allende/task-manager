"use client"

import { useMemo, useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { KanbanCard } from "./kanban-card"
import { Plus, MoreVertical, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TaskCreateModal } from "./task-create-modal"
import { Id } from "@/convex/_generated/dataModel"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"

interface Task {
  _id: string
  title: string
  description?: string
  status: any
  columnId?: string
  priority: "low" | "medium" | "high" | "urgent"
  assignedTo?: string[]
  createdBy: string
  dueDate?: string
  tags?: string[]
  position: number
  createdAt: string
  updatedAt: string
  completedAt?: string
  creator?: any
  assignees?: any[]
  commentCount?: number
}

interface Column {
  _id: string
  name: string
  color: string
  position: number
  taskCount?: number
}

interface KanbanColumnProps {
  column: Column
  tasks: Task[]
  taskIds: string[]
  isOver?: boolean
  workspaceId: Id<"workspaces">
  onTaskClick?: (task: Task) => void
}

export function KanbanColumn({ column, tasks, taskIds, isOver, workspaceId, onTaskClick }: KanbanColumnProps) {
  const { setNodeRef, isOver: isOverColumn } = useDroppable({
    id: column._id,
  })
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(column.name)
  
  const updateColumn = useMutation(api.columns.update)
  const deleteColumn = useMutation(api.columns.remove)
  
  const showIsOver = isOver || isOverColumn

  // Memoize sorted tasks
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => a.position - b.position)
  }, [tasks])

  const handleSaveName = async () => {
    if (editedName.trim() && editedName !== column.name) {
      try {
        await updateColumn({
          columnId: column._id as Id<"columns">,
          name: editedName.trim(),
        })
      } catch (error) {
        console.error("Failed to update column name:", error)
        setEditedName(column.name) // Reset on error
      }
    }
    setIsEditingName(false)
  }

  const handleDeleteColumn = async () => {
    // TODO: Show confirmation dialog with task reassignment
    console.log("Delete column:", column._id)
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-[400px] bg-muted/50 rounded-lg transition-all duration-200",
        "border-2 border-transparent",
        showIsOver && "ring-2 ring-primary ring-offset-2 bg-muted/70 border-primary/50 shadow-lg scale-[1.02]"
      )}
    >
      <div className="p-4">
        {/* Column Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={cn("w-3 h-3 rounded-full flex-shrink-0", column.color)} />
            {isEditingName ? (
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleSaveName}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveName()
                  }
                }}
                className="h-7 text-sm font-semibold"
                autoFocus
              />
            ) : (
              <h3 
                className="font-semibold text-sm truncate cursor-pointer hover:text-primary"
                onDoubleClick={() => setIsEditingName(true)}
              >
                {column.name}
              </h3>
            )}
            <Badge variant="secondary" className="ml-1">
              {tasks.length}
            </Badge>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setIsEditingName(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDeleteColumn}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tasks Container */}
        <ScrollArea className="h-[calc(100vh-16rem)] pr-2">
          <SortableContext
            items={taskIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {sortedTasks.length === 0 ? (
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
                    showIsOver
                      ? "border-primary bg-primary/10 text-primary scale-105 animate-pulse"
                      : "border-muted-foreground/25 text-muted-foreground"
                  )}
                >
                  <p className="text-sm font-medium">
                    {showIsOver ? "Drop task here" : "No tasks yet"}
                  </p>
                </div>
              ) : (
                sortedTasks.map((task) => (
                  <KanbanCard 
                    key={task._id} 
                    task={task} 
                    onClick={() => onTaskClick?.(task)}
                  />
                ))
              )}
              
              {/* Drop zone indicator for non-empty columns */}
              {sortedTasks.length > 0 && showIsOver && (
                <div className="relative h-16 flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent rounded-lg animate-pulse" />
                  <p className="text-xs font-medium text-primary z-10">Drop here to add</p>
                </div>
              )}
            </div>
          </SortableContext>
        </ScrollArea>
      </div>
      
      <TaskCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        workspaceId={workspaceId}
      />
    </div>
  )
}
"use client"

import { useMemo, useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { KanbanCard } from "./kanban-card"
import { Plus, MoreVertical, Trash2, Pencil, AlertTriangle, GripVertical } from "lucide-react"
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
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  isDragging?: boolean
  isReordering?: boolean
  workspaceId: Id<"workspaces">
  onTaskClick?: (task: Task) => void
  totalColumns: number
}

export function KanbanColumn({ column, tasks, taskIds, isOver, isDragging, isReordering, workspaceId, onTaskClick, totalColumns }: KanbanColumnProps) {
  // Make column sortable for drag and drop
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
  } = useSortable({
    id: column._id,
  })
  
  // Also make it droppable for tasks
  const { setNodeRef: setDroppableRef, isOver: isOverColumn } = useDroppable({
    id: column._id,
  })
  
  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setSortableRef(node)
    setDroppableRef(node)
  }
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(column.name)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedReassignColumn, setSelectedReassignColumn] = useState<string>("")
  const [isDeleting, setIsDeleting] = useState(false)
  
  const updateColumn = useMutation(api.columns.update)
  const deleteColumn = useMutation(api.columns.remove)
  
  // Get all columns for reassignment options
  const allColumns = useQuery(api.columns.list, { workspaceId })
  const otherColumns = allColumns?.filter(col => col._id !== column._id) || []
  
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
    if (totalColumns <= 2) {
      // This shouldn't happen as the button should be disabled, but just in case
      return
    }
    
    if (tasks.length > 0) {
      // Show dialog for reassignment
      setIsDeleteDialogOpen(true)
    } else {
      // No tasks, delete directly with confirmation
      setIsDeleteDialogOpen(true)
    }
  }
  
  const confirmDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteColumn({
        columnId: column._id as Id<"columns">,
        reassignToColumnId: tasks.length > 0 && selectedReassignColumn ? 
          selectedReassignColumn as Id<"columns"> : undefined,
      })
      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error("Failed to delete column:", error)
    } finally {
      setIsDeleting(false)
      setSelectedReassignColumn("")
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex-shrink-0 w-[400px] rounded-lg will-change-transform",
        "bg-muted/50",
        showIsOver && "kanban-drop-zone-active ring-2 ring-primary/50 shadow-lg",
        isDragging && "cursor-grabbing",
        isReordering && "animate-pulse opacity-70"
      )}
    >
      <div className="p-4">
        {/* Column Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              className="touch-none hover:bg-muted-foreground/10 rounded p-1 cursor-grab active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
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
              className="h-8 w-8 hover:bg-muted"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-muted"
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
                  disabled={totalColumns <= 2}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                  {totalColumns <= 2 && " (Min 2 columns)"}
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
                    "border border-dashed rounded-lg p-8 text-center",
                    "hover:border-primary/30 hover:bg-primary/5",
                    showIsOver ? "border-primary/60 bg-gradient-to-br from-primary/10 to-primary/5 text-primary shadow-inner" : "border-muted-foreground/20 text-muted-foreground"
                  )}
                >
                  <p className="text-sm font-medium">
                    {showIsOver ? "Drop task here" : "No tasks yet"}
                  </p>
                  {showIsOver && (
                    <div className="w-full h-1 bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20 mt-4 rounded-full animate-pulse" />
                  )}
                </div>
              ) : (
                <>
                  {sortedTasks.map((task) => (
                    <div key={task._id}>
                      <KanbanCard 
                        task={task} 
                        onClick={() => onTaskClick?.(task)}
                      />
                    </div>
                  ))}
                  
                  {/* Enhanced drop zone indicator for non-empty columns */}
                  {showIsOver && (
                    <div className="h-12 border-2 border-dashed border-primary/60 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 flex items-center justify-center shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
                        <p className="text-xs font-medium text-primary">
                          Drop here to add
                        </p>
                        <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0.5s' }} />
                      </div>
                    </div>
                  )}
                </>
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
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {tasks.length > 0 && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              Delete Column "{column.name}"
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {tasks.length > 0 ? (
                <div className="space-y-4">
                  <div>
                    This column contains <strong>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</strong>. 
                    Please select another column to move these tasks to before deletion.
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Move tasks to:</label>
                    <Select
                      value={selectedReassignColumn}
                      onValueChange={setSelectedReassignColumn}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a column" />
                      </SelectTrigger>
                      <SelectContent>
                        {otherColumns.map((col) => (
                          <SelectItem key={col._id} value={col._id}>
                            {col.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div>Are you sure you want to delete this column? This action cannot be undone.</div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting || (tasks.length > 0 && !selectedReassignColumn)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Column"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
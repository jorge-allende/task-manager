"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import {
  DndContext,
  closestCenter,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DragOverEvent,
  Active,
  Over,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { restrictToWindowEdges } from "@dnd-kit/modifiers"
import { KanbanColumn } from "./kanban-column"
import { KanbanCard } from "./kanban-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Plus, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TaskDetailModal } from "./task-detail-modal"

interface KanbanBoardProps {
  workspaceId: Id<"workspaces">
  includeArchived?: boolean
}

export type TaskStatus = "todo" | "in_progress" | "review" | "done"

// Legacy status config for backward compatibility
export const statusConfig = {
  todo: {
    label: "To Do",
    color: "bg-gray-500",
  },
  in_progress: {
    label: "In Progress",
    color: "bg-blue-500",
  },
  review: {
    label: "Review",
    color: "bg-yellow-500",
  },
  done: {
    label: "Done",
    color: "bg-green-500",
  },
} as const

export function KanbanBoard({ workspaceId, includeArchived = false }: KanbanBoardProps) {
  const boardData = useQuery(api.tasks.listForBoard, { workspaceId, includeArchived })
  const reorderTask = useMutation(api.tasks.reorder)
  const createColumn = useMutation(api.columns.create)
  const initializeColumns = useMutation(api.columns.initializeDefaults)
  
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollIntervalRef = useRef<number | null>(null)
  const mousePositionRef = useRef({ x: 0, y: 0 })

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Minimal distance to prevent accidental drags
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Use columns and tasks from boardData
  const columns = boardData?.columns || []
  const tasksByColumn = boardData?.tasksByColumn || {}
  
  // Auto-initialize columns if none exist
  useEffect(() => {
    if (boardData && columns.length === 0) {
      initializeColumns({ workspaceId }).catch(error => {
        console.error('Failed to initialize columns:', error)
      })
    }
  }, [boardData, columns.length, workspaceId, initializeColumns])

  // Find the active task for drag overlay
  const activeTask = useMemo(() => {
    if (!activeId || !tasksByColumn) return null
    
    for (const columnId of Object.keys(tasksByColumn)) {
      const task = tasksByColumn[columnId].find((t: any) => t._id === activeId)
      if (task) return task
    }
    return null
  }, [activeId, tasksByColumn])

  // Get all task IDs in order for each column
  const taskIds = useMemo(() => {
    const ids: Record<string, string[]> = {}
    
    if (!columns || !tasksByColumn) return ids
    
    columns.forEach((column: any) => {
      ids[column._id] = (tasksByColumn[column._id] || []).map((task: any) => task._id)
    })
    
    return ids
  }, [columns, tasksByColumn])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    
    // Haptic feedback for mobile devices
    if ('vibrate' in navigator && 'ontouchstart' in window) {
      navigator.vibrate(10) // Short vibration on drag start
    }
    
    // Track mouse/touch position
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (e instanceof TouchEvent) {
        const touch = e.touches[0]
        mousePositionRef.current = { x: touch.clientX, y: touch.clientY }
      } else {
        mousePositionRef.current = { x: e.clientX, y: e.clientY }
      }
    }
    
    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('touchmove', handlePointerMove, { passive: false })
    
    // Start auto-scroll detection
    const checkAutoScroll = () => {
      const container = scrollContainerRef.current
      if (!container) return
      
      const rect = container.getBoundingClientRect()
      const { x: mouseX } = mousePositionRef.current
      const scrollSpeed = 8
      const edgeSize = 80
      
      // Auto-scroll horizontally with acceleration
      if (mouseX < rect.left + edgeSize && mouseX > rect.left) {
        const intensity = 1 - (mouseX - rect.left) / edgeSize
        container.scrollLeft -= scrollSpeed * intensity
      } else if (mouseX > rect.right - edgeSize && mouseX < rect.right) {
        const intensity = 1 - (rect.right - mouseX) / edgeSize
        container.scrollLeft += scrollSpeed * intensity
      }
    }
    
    // Set up interval for continuous scrolling
    if (typeof window !== 'undefined' && window.setInterval) {
      scrollIntervalRef.current = window.setInterval(checkAutoScroll, 16) // ~60fps
    }
    
    // Store cleanup function
    (window as any).__dragCleanup = () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('touchmove', handlePointerMove)
    }
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string | null)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      
      console.log('DragEnd event:', { 
        activeId: active.id, 
        overId: over?.id,
        active,
        over 
      })
      
      if (!over || !tasksByColumn) {
        setActiveId(null)
        setOverId(null)
        return
      }

      const activeId = active.id as string
      const overId = over.id as string

      // Find source column and task
      let sourceColumnId: string | null = null
      let activeTask = null
      
      for (const columnId of Object.keys(tasksByColumn)) {
        const task = tasksByColumn[columnId].find((t: any) => t._id === activeId)
        if (task) {
          sourceColumnId = columnId
          activeTask = task
          break
        }
      }

      if (!sourceColumnId || !activeTask) {
        setActiveId(null)
        setOverId(null)
        return
      }

      // Determine target column and position
      let targetColumnId: string = sourceColumnId
      let beforeTaskId: string | undefined
      let afterTaskId: string | undefined

      // Check if dropped on a column
      const isDroppedOnColumn = columns.some((col: any) => col._id === overId)
      
      if (isDroppedOnColumn) {
        targetColumnId = overId
        // Place at the beginning of the column
        const targetTasks = tasksByColumn[targetColumnId] || []
        if (targetTasks.length > 0) {
          beforeTaskId = targetTasks[0]._id
        }
      } else {
        // Dropped on a task - find its column and position
        for (const columnId of Object.keys(tasksByColumn)) {
          const taskIndex = tasksByColumn[columnId].findIndex((t: any) => t._id === overId)
          if (taskIndex !== -1) {
            targetColumnId = columnId
            const columnTasks = tasksByColumn[columnId]
            
            // If moving within the same column
            if (sourceColumnId === targetColumnId) {
              const oldIndex = columnTasks.findIndex((t: any) => t._id === activeId)
              const newIndex = taskIndex
              
              if (oldIndex !== newIndex) {
                // Calculate before and after based on movement direction
                if (oldIndex < newIndex) {
                  // Moving down
                  afterTaskId = columnTasks[newIndex]._id
                  beforeTaskId = columnTasks[newIndex + 1]?._id
                } else {
                  // Moving up
                  beforeTaskId = columnTasks[newIndex]._id
                  afterTaskId = columnTasks[newIndex - 1]?._id
                }
              }
            } else {
              // Moving to a different column
              afterTaskId = columnTasks[taskIndex - 1]?._id
              beforeTaskId = columnTasks[taskIndex]._id
            }
            break
          }
        }
      }

      // Only make the mutation if there's an actual change
      if (targetColumnId !== sourceColumnId || beforeTaskId !== undefined || afterTaskId !== undefined) {
        try {
          const mutationParams = {
            taskId: activeId as Id<"tasks">,
            newColumnId: targetColumnId as Id<"columns">,
            beforeTaskId: beforeTaskId as Id<"tasks"> | undefined,
            afterTaskId: afterTaskId as Id<"tasks"> | undefined,
          }
          console.log('Calling reorderTask mutation with:', mutationParams)
          await reorderTask(mutationParams)
        } catch (error) {
          console.error("Failed to reorder task:", error)
        }
      } else {
        console.log('No change detected, skipping mutation')
      }

      setActiveId(null)
      setOverId(null)
      
      // Clear auto-scroll interval
      if (scrollIntervalRef.current && typeof window !== 'undefined') {
        window.clearInterval(scrollIntervalRef.current)
        scrollIntervalRef.current = null
      }
      
      // Clean up mouse tracking
      if ((window as any).__dragCleanup) {
        (window as any).__dragCleanup()
        delete (window as any).__dragCleanup
      }
    },
    [tasksByColumn, columns, reorderTask]
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setOverId(null)
    
    // Clear auto-scroll interval
    if (scrollIntervalRef.current && typeof window !== 'undefined') {
      window.clearInterval(scrollIntervalRef.current)
      scrollIntervalRef.current = null
    }
    
    // Clean up mouse tracking
    if ((window as any).__dragCleanup) {
      (window as any).__dragCleanup()
      delete (window as any).__dragCleanup
    }
  }, [])

  const handleAddColumn = useCallback(async () => {
    if (columns.length >= 4) {
      // Show error toast or message
      console.error("Maximum 4 columns allowed")
      return
    }
    
    try {
      await createColumn({
        workspaceId,
        name: `New Column ${columns.length + 1}`,
        color: "bg-purple-500",
      })
    } catch (error) {
      console.error("Failed to create column:", error)
    }
  }, [createColumn, workspaceId, columns.length])

  const handleTaskClick = useCallback((task: any) => {
    setSelectedTask(task)
    setIsDetailSheetOpen(true)
  }, [])

  const handleEditTask = useCallback(() => {
    // The edit modal will be opened from within the detail sheet
    // This is just to satisfy the interface
  }, [])

  if (!boardData) {
    return (
      <div className="flex gap-6 p-6 overflow-x-auto">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-shrink-0 w-80">
            <div className="bg-muted/50 rounded-lg p-4">
              <Skeleton className="h-8 w-32 mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Check if there are any tasks
  const hasAnyTasks = Object.values(tasksByColumn).some((tasks: any) => tasks.length > 0)

  if (columns.length === 0) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Initializing your board columns...</span>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      modifiers={[restrictToWindowEdges]}
    >
      <div className="flex items-start gap-2 px-6 pb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddColumn}
          disabled={columns.length >= 4}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Column
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          Manage Columns
        </Button>
      </div>
      
      <div ref={scrollContainerRef} className="flex gap-6 p-6 pt-0 overflow-x-auto min-h-[calc(100vh-12rem)] scroll-smooth">
        {columns.map((column: any) => (
          <KanbanColumn
            key={column._id}
            column={column}
            tasks={tasksByColumn[column._id] || []}
            taskIds={taskIds[column._id] || []}
            isOver={overId === column._id}
            workspaceId={workspaceId}
            onTaskClick={handleTaskClick}
          />
        ))}
      </div>
      
      <DragOverlay dropAnimation={{
        duration: 200,
        easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
      }}>
        {activeTask ? (
          <div className="cursor-grabbing">
            <div className="opacity-95 rotate-2 scale-105 shadow-2xl animate-pulse">
              <KanbanCard task={activeTask} isDragging />
            </div>
          </div>
        ) : null}
      </DragOverlay>
      
      <TaskDetailModal
        task={selectedTask}
        isOpen={isDetailSheetOpen}
        onClose={() => {
          setIsDetailSheetOpen(false)
          setSelectedTask(null)
        }}
        onEdit={handleEditTask}
      />
    </DndContext>
  )
}
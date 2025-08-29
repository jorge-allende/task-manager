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
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable"
import { restrictToWindowEdges } from "@dnd-kit/modifiers"
import { KanbanColumn } from "./kanban-column"
import { KanbanCard } from "./kanban-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Plus, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TaskDetailModal } from "./task-detail-modal"
import { reorderTaskMap } from "@/lib/reorder"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

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
  const reorderColumn = useMutation(api.columns.reorder)
  const createColumn = useMutation(api.columns.create)
  const initializeColumns = useMutation(api.columns.initializeDefaults)
  
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'task' | 'column' | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)
  const [isReordering, setIsReordering] = useState(false)
  const [optimisticColumns, setOptimisticColumns] = useState<any[]>([])
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollIntervalRef = useRef<number | null>(null)
  const mousePositionRef = useRef({ x: 0, y: 0 })
  const { toast } = useToast()

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

  // Use columns and tasks from boardData, with optimistic updates during reordering
  const columns = isReordering && optimisticColumns.length > 0 ? optimisticColumns : (boardData?.columns || [])
  const tasksByColumn = boardData?.tasksByColumn || {}
  
  // Update optimistic columns when real data changes
  useEffect(() => {
    if (!isReordering && boardData?.columns) {
      setOptimisticColumns([])
    }
  }, [boardData?.columns, isReordering])
  
  // Auto-initialize columns if none exist
  useEffect(() => {
    if (boardData && columns.length === 0) {
      initializeColumns({ workspaceId }).catch(error => {
        console.error('Failed to initialize columns:', error)
      })
    }
  }, [boardData, columns.length, workspaceId, initializeColumns])

  // Find the active item (task or column) for drag overlay
  const activeTask = useMemo(() => {
    if (!activeId || activeType !== 'task' || !tasksByColumn) return null
    
    for (const columnId of Object.keys(tasksByColumn)) {
      const task = tasksByColumn[columnId].find((t: any) => t._id === activeId)
      if (task) return task
    }
    return null
  }, [activeId, activeType, tasksByColumn])
  
  const activeColumn = useMemo(() => {
    if (!activeId || activeType !== 'column' || !columns) return null
    return columns.find((col: any) => col._id === activeId)
  }, [activeId, activeType, columns])

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
    const { active } = event
    setActiveId(active.id as string)
    
    // Determine if we're dragging a task or a column
    const isColumn = columns.some((col: any) => col._id === active.id)
    setActiveType(isColumn ? 'column' : 'task')
    
    console.log('🚀 Drag start:', { 
      activeId: active.id, 
      type: isColumn ? 'column' : 'task',
      columnName: isColumn ? columns.find((col: any) => col._id === active.id)?.name : 'N/A'
    })
    
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
  }, [columns])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const newOverId = event.over?.id as string | null
    if (newOverId !== overId) {
      console.log('🎯 Drag over:', { 
        overId: newOverId, 
        activeType,
        overType: columns.some((col: any) => col._id === newOverId) ? 'column' : 'task'
      })
    }
    setOverId(newOverId)
  }, [overId, activeType, columns])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      
      console.log('🏁 Drag end:', { 
        activeId: active.id, 
        overId: over?.id,
        activeType,
        hasOver: !!over
      })
      
      // Cleanup function
      const cleanup = () => {
        setActiveId(null)
        setActiveType(null)
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
      }
      
      // No valid drop target
      if (!over) {
        console.log('❌ No valid drop target')
        cleanup()
        return
      }

      const activeId = active.id as string
      const overId = over.id as string
      
      // Handle column reordering
      if (activeType === 'column') {
        const realColumns = boardData?.columns || []
        const activeColumnIndex = realColumns.findIndex((col: any) => col._id === activeId)
        
        // When dragging a column, overId might be another column or null
        // We need to find which column we're dropping onto
        let overColumnIndex = -1;
        
        // Check if we're dropping directly on a column
        if (overId) {
          overColumnIndex = realColumns.findIndex((col: any) => col._id === overId)
        }
        
        // If we couldn't find a valid drop target, bail out
        if (activeColumnIndex === -1 || overColumnIndex === -1) {
          cleanup()
          return
        }
        
        // Don't do anything if dropping on the same position
        if (activeColumnIndex === overColumnIndex) {
          cleanup()
          return
        }
        
        // The target position is simply the array index where we want to place the column
        // The backend will handle updating all position values accordingly
        const targetPosition = overColumnIndex;
        
        console.log('🔄 Column Reorder Debug:', {
          activeColumnId: activeId,
          activeColumnIndex,
          overColumnIndex,
          activeColumnName: realColumns[activeColumnIndex]?.name,
          targetColumnName: realColumns[overColumnIndex]?.name,
          activeColumnPosition: realColumns[activeColumnIndex]?.position,
          targetColumnPosition: realColumns[overColumnIndex]?.position,
          calculatedTargetPosition: targetPosition,
          totalColumns: realColumns.length,
          currentPositions: realColumns.map(col => ({ id: col._id, name: col.name, position: col.position }))
        })
        
        // Create optimistic column order
        const optimisticColumnsArray = [...realColumns]
        const [movedColumn] = optimisticColumnsArray.splice(activeColumnIndex, 1)
        optimisticColumnsArray.splice(overColumnIndex, 0, movedColumn)
        
        console.log('🔄 Optimistic Update:', {
          originalOrder: realColumns.map(col => col.name),
          newOptimisticOrder: optimisticColumnsArray.map(col => col.name),
          movedColumn: movedColumn.name,
          expectedFinalPositions: optimisticColumnsArray.map((col, idx) => ({ name: col.name, expectedPos: idx }))
        })
        
        // Set optimistic state
        setIsReordering(true)
        setOptimisticColumns(optimisticColumnsArray)
        
        // Validate the target position before attempting the mutation
        if (targetPosition < 0 || targetPosition >= realColumns.length) {
          console.error("❌ Invalid target position:", targetPosition, "for", realColumns.length, "columns")
          toast({
            title: "Invalid column position",
            description: "Cannot move column to the specified position",
            variant: "destructive"
          })
          setOptimisticColumns([])
          setIsReordering(false)
          cleanup()
          return
        }

        // Retry logic for mutation
        const maxRetries = 3
        let retryCount = 0
        let lastError: Error | null = null

        while (retryCount < maxRetries) {
          try {
            console.log(`🔄 Attempt ${retryCount + 1}/${maxRetries}: Sending reorderColumn mutation:`, {
              columnId: activeId,
              newPosition: targetPosition,
              originalOverColumnIndex: overColumnIndex
            })
            
            const result = await reorderColumn({
              columnId: activeId as Id<"columns">,
              newPosition: targetPosition,
            })
            
            console.log('✅ Column reorder mutation completed successfully:', result)
            toast({
              title: "Column reordered successfully",
              variant: "default"
            })
            
            // Success - break out of retry loop
            lastError = null
            break
            
          } catch (error) {
            lastError = error as Error
            retryCount++
            
            console.error(`❌ Attempt ${retryCount}/${maxRetries} failed:`, error)
            
            // If this isn't the last retry, wait before trying again
            if (retryCount < maxRetries) {
              console.log(`⏳ Waiting 1 second before retry ${retryCount + 1}...`)
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          }
        }

        // If all retries failed, handle the error
        if (lastError) {
          console.error("❌ All retry attempts failed. Final error:", lastError)
          console.error("❌ Error details:", {
            errorMessage: lastError.message,
            errorStack: lastError.stack,
            columnId: activeId,
            newPosition: targetPosition,
            originalOverColumnIndex: overColumnIndex,
            totalRetries: retryCount
          })
          
          // Rollback optimistic update on error
          setOptimisticColumns([])
          
          toast({
            title: "Failed to reorder column",
            description: `${lastError.message} (${retryCount} attempts)`,
            variant: "destructive"
          })
        }
        
        setIsReordering(false)
        cleanup()
        return
      }
      
      // Handle task reordering (existing logic)
      if (!tasksByColumn) {
        cleanup()
        return
      }

      // Find source column and task index
      let sourceColumnId: string | null = null
      let sourceIndex = -1
      let activeTask = null
      
      for (const columnId of Object.keys(tasksByColumn)) {
        const index = tasksByColumn[columnId].findIndex((t: any) => t._id === activeId)
        if (index !== -1) {
          sourceColumnId = columnId
          sourceIndex = index
          activeTask = tasksByColumn[columnId][index]
          break
        }
      }

      if (!sourceColumnId || sourceIndex === -1 || !activeTask) {
        cleanup()
        return
      }

      // Determine destination column and index
      let destinationColumnId: string = sourceColumnId
      let destinationIndex = sourceIndex

      // Check if dropped on a column
      const isDroppedOnColumn = columns.some((col: any) => col._id === overId)
      
      if (isDroppedOnColumn) {
        destinationColumnId = overId
        destinationIndex = 0 // Place at the beginning of the column
      } else {
        // Dropped on a task - find its column and position
        for (const columnId of Object.keys(tasksByColumn)) {
          const index = tasksByColumn[columnId].findIndex((t: any) => t._id === overId)
          if (index !== -1) {
            destinationColumnId = columnId
            
            // If moving within the same column
            if (sourceColumnId === destinationColumnId) {
              // Adjust index based on direction of movement
              destinationIndex = sourceIndex < index ? index : index
            } else {
              // Moving to a different column - insert at the position
              destinationIndex = index
            }
            break
          }
        }
      }

      // No change if dropping in the same position
      if (sourceColumnId === destinationColumnId && sourceIndex === destinationIndex) {
        cleanup()
        return
      }

      // Use the reorder utility to get the new task arrangement
      const reorderedTasks = reorderTaskMap({
        taskMap: tasksByColumn,
        source: { droppableId: sourceColumnId, index: sourceIndex },
        destination: { droppableId: destinationColumnId, index: destinationIndex }
      })

      // Calculate position parameters for the mutation
      let beforeTaskId: string | undefined
      let afterTaskId: string | undefined
      
      const destinationTasks = reorderedTasks[destinationColumnId]
      const taskIndexInDestination = destinationTasks.findIndex((t: any) => t._id === activeId)
      
      if (taskIndexInDestination > 0) {
        afterTaskId = destinationTasks[taskIndexInDestination - 1]._id
      }
      if (taskIndexInDestination < destinationTasks.length - 1) {
        beforeTaskId = destinationTasks[taskIndexInDestination + 1]._id
      }

      // Make the mutation to persist the change
      try {
        const mutationParams = {
          taskId: activeId as Id<"tasks">,
          newColumnId: destinationColumnId as Id<"columns">,
          beforeTaskId: beforeTaskId as Id<"tasks"> | undefined,
          afterTaskId: afterTaskId as Id<"tasks"> | undefined,
        }
        
        await reorderTask(mutationParams)
      } catch (error) {
        console.error("Failed to reorder task:", error)
      }

      cleanup()
    },
    [tasksByColumn, columns, reorderTask, reorderColumn, activeType]
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setActiveType(null)
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
    <div className={cn(activeId && "dragging-active")}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
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
      
      <div ref={scrollContainerRef} className="flex gap-6 p-6 pt-0 overflow-x-auto min-h-[calc(100vh-12rem)] scroll-smooth gpu-accelerated">
        <SortableContext
          items={columns.map((col: any) => col._id)}
          strategy={horizontalListSortingStrategy}
        >
          {columns.map((column: any) => (
            <KanbanColumn
              key={column._id}
              column={column}
              tasks={tasksByColumn[column._id] || []}
              taskIds={taskIds[column._id] || []}
              isOver={overId === column._id && activeType === 'task'}
              isDragging={activeId === column._id}
              isReordering={isReordering}
              workspaceId={workspaceId}
              onTaskClick={handleTaskClick}
              totalColumns={columns.length}
            />
          ))}
        </SortableContext>
      </div>
      
      <DragOverlay 
        dropAnimation={null}
        style={{
          cursor: 'grabbing',
          zIndex: 9999,
        }}
        modifiers={[restrictToWindowEdges]}
      >
        {activeTask && (
          <div className="kanban-drag-overlay">
            <div className="bg-background border border-border rounded-lg shadow-2xl ring-2 ring-primary/20">
              <KanbanCard task={activeTask} isDragging={false} />
            </div>
          </div>
        )}
        {activeColumn && (
          <div className="kanban-drag-overlay">
            <div className="w-[400px] rounded-lg bg-muted/90 border-2 border-primary/50 shadow-2xl">
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full flex-shrink-0", activeColumn.color)} />
                  <h3 className="font-semibold text-sm truncate">{activeColumn.name}</h3>
                </div>
              </div>
            </div>
          </div>
        )}
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
    </div>
  )
}
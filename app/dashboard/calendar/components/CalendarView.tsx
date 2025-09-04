'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, isToday, isSameMonth, isSameDay } from 'date-fns'
import { MonthView } from './MonthView'
import { AgendaView } from './AgendaView'
import { WeekView } from './WeekView'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ChevronLeft, ChevronRight, Calendar, List, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import { KanbanCard } from '@/components/kanban/kanban-card'
import { TaskCreateModal } from '@/components/kanban/task-create-modal'
import { CalendarFilters, FilterState } from './CalendarFilters'

interface CalendarViewProps {
  workspaceId: Id<"workspaces">
}

type ViewMode = 'month' | 'week' | 'agenda'

export function CalendarView({ workspaceId }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createModalDate, setCreateModalDate] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    priorities: [],
    statuses: [],
    assigneeIds: [],
    tags: [],
    showCompleted: true,
  })

  // Fetch all tasks for the workspace
  const tasks = useQuery(api.tasks.listForBoardLegacy, { 
    workspaceId, 
    includeArchived: false 
  })

  const updateTask = useMutation(api.tasks.update)

  // Configure drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  // Filter tasks by date range for current view
  const { startDate, endDate } = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    
    // Include days from previous/next month visible in calendar grid
    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)
    
    return {
      startDate: calendarStart,
      endDate: calendarEnd,
    }
  }, [currentDate])

  // Filter and group tasks by date
  const tasksByDate = useMemo(() => {
    if (!tasks) return new Map<string, any[]>()
    
    const map = new Map<string, any[]>()
    
    // Flatten all tasks from different statuses with defensive checks
    let allTasks = [
      ...(tasks.todo || []),
      ...(tasks.in_progress || []),
      ...(tasks.review || []),
      ...(tasks.done || []),
    ]
    
    // Apply filters
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      allTasks = allTasks.filter(task => 
        task.title?.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower)
      )
    }
    
    if (filters.priorities.length > 0) {
      allTasks = allTasks.filter(task => filters.priorities.includes(task.priority))
    }
    
    if (filters.statuses.length > 0) {
      allTasks = allTasks.filter(task => filters.statuses.includes(task.status))
    }
    
    if (filters.assigneeIds.length > 0) {
      allTasks = allTasks.filter(task => 
        task.assignedTo?.some((userId: string) => filters.assigneeIds.includes(userId))
      )
    }
    
    if (filters.tags.length > 0) {
      allTasks = allTasks.filter(task =>
        task.tags?.some((tag: string) => filters.tags.includes(tag))
      )
    }
    
    if (!filters.showCompleted) {
      allTasks = allTasks.filter(task => task.status !== 'done')
    }
    
    // Group by due date
    allTasks.forEach(task => {
      if (task.dueDate) {
        const dateKey = format(new Date(task.dueDate), 'yyyy-MM-dd')
        const existing = map.get(dateKey) || []
        map.set(dateKey, [...existing, task])
      }
    })
    
    // Sort tasks within each date
    map.forEach((tasksForDate, dateKey) => {
      map.set(dateKey, tasksForDate.sort((a, b) => {
        // Sort by priority first
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
        const priorityDiff = priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]
        if (priorityDiff !== 0) return priorityDiff
        
        // Then by status
        const statusOrder = { todo: 0, in_progress: 1, review: 2, done: 3 }
        return statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder]
      }))
    })
    
    return map
  }, [tasks, filters])

  // Find active task for drag overlay
  const activeTask = useMemo(() => {
    if (!activeTaskId || !tasks) return null
    
    const allTasks = [
      ...(tasks.todo || []),
      ...(tasks.in_progress || []),
      ...(tasks.review || []),
      ...(tasks.done || []),
    ]
    
    return allTasks.find(task => task._id === activeTaskId) || null
  }, [activeTaskId, tasks])

  // Navigation handlers
  const handlePreviousMonth = useCallback(() => {
    setCurrentDate(prev => subMonths(prev, 1))
  }, [])

  const handleNextMonth = useCallback(() => {
    setCurrentDate(prev => addMonths(prev, 1))
  }, [])

  const handleToday = useCallback(() => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }, [])

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over || !active) {
      setActiveTaskId(null)
      return
    }
    
    const taskId = active.id as string
    const targetDateStr = over.id as string
    
    // Check if it's a valid date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) {
      setActiveTaskId(null)
      return
    }
    
    try {
      await updateTask({
        id: taskId as Id<"tasks">,
        dueDate: targetDateStr,
      })
    } catch (error) {
      console.error('Failed to update task due date:', error)
    }
    
    setActiveTaskId(null)
  }, [updateTask])

  const handleDragCancel = useCallback(() => {
    setActiveTaskId(null)
  }, [])

  // Handle date click
  const handleDateClick = useCallback((date: Date) => {
    setSelectedDate(date)
    setCreateModalDate(format(date, 'yyyy-MM-dd'))
  }, [])

  // Handle create task with date
  const handleCreateTaskForDate = useCallback((date: string) => {
    setCreateModalDate(date)
    setIsCreateModalOpen(true)
  }, [])

  // Get unique tags for filters (assignees would need separate user fetching)
  const { uniqueAssignees, uniqueTags } = useMemo(() => {
    if (!tasks) return { uniqueAssignees: [], uniqueTags: [] }
    
    const allTasks = [
      ...(tasks.todo || []),
      ...(tasks.in_progress || []),
      ...(tasks.review || []),
      ...(tasks.done || []),
    ]
    
    const tagsSet = new Set<string>()
    
    allTasks.forEach(task => {
      task.tags?.forEach((tag: string) => {
        tagsSet.add(tag)
      })
    })
    
    return {
      uniqueAssignees: [], // Would need to fetch user details separately
      uniqueTags: Array.from(tagsSet),
    }
  }, [tasks])

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Filters */}
      <CalendarFilters
        onFiltersChange={setFilters}
        assignees={uniqueAssignees}
        tags={uniqueTags}
      />
      
      {/* Calendar Header */}
      <div className="flex items-center justify-between animate-in slide-in-from-top duration-300">
        <div className="flex items-center gap-4">
          <h3 className="text-2xl font-semibold">
            {format(currentDate, 'MMMM yyyy')}
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePreviousMonth}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextMonth}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <ToggleGroup 
          type="single" 
          value={viewMode} 
          onValueChange={(value) => value && setViewMode(value as ViewMode)}
        >
          <ToggleGroupItem value="month" aria-label="Month view">
            <Calendar className="h-4 w-4 mr-2" />
            Month
          </ToggleGroupItem>
          <ToggleGroupItem value="week" aria-label="Week view">
            <CalendarDays className="h-4 w-4 mr-2" />
            Week
          </ToggleGroupItem>
          <ToggleGroupItem value="agenda" aria-label="Agenda view">
            <List className="h-4 w-4 mr-2" />
            Agenda
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Calendar Content */}
      <div className="animate-in slide-in-from-bottom duration-500">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {viewMode === 'month' && (
          <MonthView
            currentDate={currentDate}
            tasksByDate={tasksByDate}
            selectedDate={selectedDate}
            onDateClick={handleDateClick}
            onCreateTask={handleCreateTaskForDate}
            startDate={startDate}
            endDate={endDate}
          />
        )}
        {viewMode === 'week' && (
          <WeekView
            currentDate={currentDate}
            tasksByDate={tasksByDate}
            selectedDate={selectedDate}
            onDateClick={handleDateClick}
            onCreateTask={handleCreateTaskForDate}
          />
        )}
        {viewMode === 'agenda' && (
          <AgendaView
            currentDate={currentDate}
            tasksByDate={tasksByDate}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            onCreateTask={handleCreateTaskForDate}
          />
        )}
        
        <DragOverlay>
          {activeTask ? (
            <div className="opacity-90 rotate-2 scale-105 animate-pulse-subtle">
              <div className="bg-background/95 backdrop-blur-sm rounded-lg shadow-2xl border-2 border-primary/50">
                <KanbanCard task={activeTask} isDragging />
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      </div>

      {/* Create Task Modal */}
      <TaskCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          setCreateModalDate(null)
        }}
        workspaceId={workspaceId}
      />
    </div>
  )
}
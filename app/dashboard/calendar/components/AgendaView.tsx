'use client'

import { useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay, addDays } from 'date-fns'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Plus, Calendar, AlertCircle } from 'lucide-react'
import { TaskEditModal } from '@/components/kanban/task-edit-modal'
import { useState } from 'react'
import { Id } from '@/convex/_generated/dataModel'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface AgendaViewProps {
  currentDate: Date
  tasksByDate: Map<string, any[]>
  selectedDate: Date | null
  onDateSelect: (date: Date) => void
  onCreateTask: (date: string) => void
}

const priorityConfig = {
  low: { label: 'Low', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
}

const statusConfig = {
  todo: { label: 'To Do', color: 'bg-gray-500' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500' },
  review: { label: 'Review', color: 'bg-yellow-500' },
  done: { label: 'Done', color: 'bg-green-500' },
}

interface TaskItemProps {
  task: any
}

function TaskItem({ task }: TaskItemProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={cn(
          'group p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer',
          isDragging && 'opacity-50'
        )}
        onClick={() => setIsEditModalOpen(true)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <h4 className="font-medium">{task.title}</h4>
            {task.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {task.description}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className={cn('text-xs', task.priority && priorityConfig[task.priority as keyof typeof priorityConfig]?.color)}>
                {task.priority && priorityConfig[task.priority as keyof typeof priorityConfig]?.label || 'No priority'}
              </Badge>
              <div className="flex items-center gap-1">
                <div className={cn('w-2 h-2 rounded-full', task.status && statusConfig[task.status as keyof typeof statusConfig]?.color)} />
                <span className="text-xs text-muted-foreground">
                  {task.status && statusConfig[task.status as keyof typeof statusConfig]?.label || 'No status'}
                </span>
              </div>
              {task.assignees?.length > 0 && (
                <div className="flex items-center gap-1">
                  <div className="flex -space-x-1">
                    {task.assignees.slice(0, 3).map((user: any) => (
                      <div
                        key={user._id}
                        className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background"
                        title={user.name}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                  </div>
                  {task.assignees.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{task.assignees.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <TaskEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        task={task}
      />
    </>
  )
}

interface DayGroupProps {
  date: Date
  dateKey: string
  tasks: any[]
  isSelected: boolean
  onDateSelect: () => void
  onCreateTask: () => void
}

function DayGroup({ date, dateKey, tasks, isSelected, onDateSelect, onCreateTask }: DayGroupProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
  })

  const taskIds = tasks.map(task => task._id)
  const today = isToday(date)
  const dayName = format(date, 'EEEE')
  const dayNumber = format(date, 'd')
  const monthName = format(date, 'MMM')

  // Count tasks by status
  const statusCounts = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'space-y-3',
        isOver && 'ring-2 ring-primary ring-offset-2 rounded-lg'
      )}
    >
      <div 
        className={cn(
          'flex items-center justify-between sticky top-0 bg-background z-10 py-2',
          isSelected && 'text-primary'
        )}
      >
        <button
          onClick={onDateSelect}
          className="flex items-center gap-3 hover:text-primary transition-colors"
        >
          <div className={cn(
            'flex flex-col items-center justify-center w-12 h-12 rounded-lg',
            today ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}>
            <span className="text-xs font-medium">{monthName}</span>
            <span className="text-lg font-bold">{dayNumber}</span>
          </div>
          <div>
            <h3 className="font-semibold">{dayName}</h3>
            {tasks.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <span key={status} className="flex items-center gap-1">
                    <div className={cn('w-2 h-2 rounded-full', statusConfig[status as keyof typeof statusConfig].color)} />
                    {String(count)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreateTask}
        >
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      {tasks.length > 0 ? (
        <SortableContext
          items={taskIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskItem key={task._id} task={task} />
            ))}
          </div>
        </SortableContext>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No tasks scheduled for this day</p>
        </div>
      )}
    </div>
  )
}

export function AgendaView({
  currentDate,
  tasksByDate,
  selectedDate,
  onDateSelect,
  onCreateTask,
}: AgendaViewProps) {
  // Generate days for the current month
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentDate)
    const end = endOfMonth(currentDate)
    return eachDayOfInterval({ start, end })
  }, [currentDate])

  // Get tasks without due dates
  const unscheduledTasks = useMemo(() => {
    // This would need to be implemented in the parent component
    // For now, return empty array
    return []
  }, [])

  return (
    <ScrollArea className="h-[calc(100vh-16rem)]">
      <div className="space-y-6 pr-4">
        {daysInMonth.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd')
          const tasks = tasksByDate.get(dateKey) || []
          
          // Show days with tasks or selected date or today
          if (tasks.length === 0 && !isToday(date) && (!selectedDate || !isSameDay(date, selectedDate))) {
            return null
          }
          
          return (
            <DayGroup
              key={dateKey}
              date={date}
              dateKey={dateKey}
              tasks={tasks}
              isSelected={selectedDate ? isSameDay(date, selectedDate) : false}
              onDateSelect={() => onDateSelect(date)}
              onCreateTask={() => onCreateTask(dateKey)}
            />
          )
        })}

        {/* Unscheduled tasks section */}
        {unscheduledTasks.length > 0 && (
          <div className="space-y-3 mt-8">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Unscheduled Tasks
              </h3>
            </div>
            <div className="space-y-2">
              {unscheduledTasks.map((task: any) => (
                <TaskItem key={task._id} task={task} />
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
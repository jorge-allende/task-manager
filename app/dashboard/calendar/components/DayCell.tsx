'use client'

import { memo } from 'react'
import { format } from 'date-fns'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus } from 'lucide-react'
import { TaskCard } from './TaskCard'

interface DayCellProps {
  date: Date
  dateKey: string
  tasks: any[]
  isCurrentMonth: boolean
  isSelected: boolean
  isToday: boolean
  onClick: () => void
  onCreateTask: () => void
}

const priorityColors = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
}

const statusColors = {
  todo: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  review: 'bg-yellow-500',
  done: 'bg-green-500',
}

function DayCellComponent({
  date,
  dateKey,
  tasks,
  isCurrentMonth,
  isSelected,
  isToday,
  onClick,
  onCreateTask,
}: DayCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
  })

  const taskIds = tasks.map(task => task._id)
  const isWeekend = date.getDay() === 0 || date.getDay() === 6

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[140px] p-3 transition-all duration-200 cursor-pointer relative',
        'bg-gradient-to-br from-background to-background/95',
        'hover:shadow-md hover:z-10 hover:scale-[1.02]',
        'after:absolute after:inset-0 after:border after:border-border/10 after:rounded-lg after:pointer-events-none',
        !isCurrentMonth && 'opacity-40',
        isWeekend && 'bg-muted/20',
        isSelected && 'ring-2 ring-primary/50 bg-accent/30',
        isToday && 'bg-gradient-to-br from-primary/10 to-primary/5 after:border-primary/30',
        isOver && 'bg-primary/10 ring-2 ring-primary shadow-lg scale-[1.02]'
      )}
      onClick={onClick}
    >
      {/* Date Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm font-semibold transition-all relative',
              isToday && 'bg-primary text-primary-foreground rounded-full px-2.5 py-1 shadow-sm animate-pulse-subtle',
              !isToday && isWeekend && 'text-muted-foreground',
              !isToday && !isWeekend && 'text-foreground'
            )}
          >
            {format(date, 'd')}
            {isToday && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </span>
          {tasks.length > 0 && (
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground font-medium',
              tasks.length > 5 && 'bg-orange-500/20 text-orange-600 dark:text-orange-400'
            )}>
              {tasks.length}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-primary/10"
          onClick={(e) => {
            e.stopPropagation()
            onCreateTask()
          }}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Tasks */}
      {tasks.length > 0 && (
        <SortableContext
          items={taskIds}
          strategy={verticalListSortingStrategy}
        >
          <ScrollArea className="h-[90px] pr-1">
            <div className="space-y-1.5">
              {tasks.slice(0, 4).map((task) => (
                <TaskCard key={task._id} task={task} />
              ))}
              {tasks.length > 4 && (
                <button 
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors pl-1 font-medium"
                  onClick={(e) => {
                    e.stopPropagation()
                    onClick()
                  }}
                >
                  +{tasks.length - 4} more tasks
                </button>
              )}
            </div>
          </ScrollArea>
        </SortableContext>
      )}
    </div>
  )
}

export const DayCell = memo(DayCellComponent, (prevProps, nextProps) => {
  return (
    prevProps.dateKey === nextProps.dateKey &&
    prevProps.isCurrentMonth === nextProps.isCurrentMonth &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isToday === nextProps.isToday &&
    JSON.stringify(prevProps.tasks) === JSON.stringify(nextProps.tasks)
  )
})
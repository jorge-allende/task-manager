'use client'

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

export function DayCell({
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

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[120px] border-b border-r p-2 transition-colors cursor-pointer',
        'hover:bg-muted/50',
        !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
        isSelected && 'bg-accent',
        isToday && 'bg-accent/50',
        isOver && 'bg-primary/10 ring-2 ring-primary ring-inset'
      )}
      onClick={onClick}
    >
      {/* Date Header */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            'text-sm font-medium',
            isToday && 'bg-primary text-primary-foreground rounded-full px-2 py-0.5'
          )}
        >
          {format(date, 'd')}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 hover:opacity-100 transition-opacity"
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
          <ScrollArea className="h-[80px]">
            <div className="space-y-1">
              {tasks.slice(0, 3).map((task) => (
                <TaskCard key={task._id} task={task} />
              ))}
              {tasks.length > 3 && (
                <div className="text-xs text-muted-foreground pl-1">
                  +{tasks.length - 3} more
                </div>
              )}
            </div>
          </ScrollArea>
        </SortableContext>
      )}
    </div>
  )
}
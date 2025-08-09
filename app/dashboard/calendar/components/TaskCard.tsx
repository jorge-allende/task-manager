'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import { TaskEditModal } from '@/components/kanban/task-edit-modal'
import { Id } from '@/convex/_generated/dataModel'

interface TaskCardProps {
  task: any
}

const priorityColors = {
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

const statusIcons = {
  todo: '○',
  in_progress: '◐',
  review: '◓',
  done: '●',
}

export function TaskCard({ task }: TaskCardProps) {
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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditModalOpen(true)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={cn(
          'group p-2 rounded-md bg-background border cursor-pointer',
          'hover:shadow-sm transition-all',
          isDragging && 'opacity-50'
        )}
        onClick={handleClick}
      >
        <div className="flex items-start gap-1">
          <span className="text-xs text-muted-foreground mt-0.5">
            {statusIcons[task.status as keyof typeof statusIcons]}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{task.title}</p>
            {(task.priority !== 'medium' || task.assignees?.length > 0) && (
              <div className="flex items-center gap-1 mt-1">
                {task.priority !== 'medium' && (
                  <Badge 
                    variant="secondary" 
                    className={cn('h-4 px-1 text-[10px]', priorityColors[task.priority as keyof typeof priorityColors])}
                  >
                    {task.priority}
                  </Badge>
                )}
                {task.assignees?.length > 0 && (
                  <div className="flex -space-x-1">
                    {task.assignees.slice(0, 2).map((user: any) => (
                      <div
                        key={user._id}
                        className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-medium border border-background"
                        title={user.name}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {task.assignees.length > 2 && (
                      <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-medium border border-background">
                        +{task.assignees.length - 2}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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
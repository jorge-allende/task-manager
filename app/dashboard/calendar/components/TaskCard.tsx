'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useState, useMemo, memo } from 'react'
import { TaskEditModal } from '@/components/kanban/task-edit-modal'
import { Id } from '@/convex/_generated/dataModel'
import { MessageSquare, Paperclip, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TaskContextMenu } from './TaskContextMenu'

interface TaskCardProps {
  task: any
}

const priorityColors = {
  low: 'border-l-blue-500 bg-blue-500/5',
  medium: 'border-l-yellow-500 bg-yellow-500/5',
  high: 'border-l-orange-500 bg-orange-500/5',
  urgent: 'border-l-red-500 bg-red-500/5 animate-pulse-subtle',
}

const priorityDots = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
}

const statusIcons = {
  todo: '○',
  in_progress: '◐',
  review: '◓',
  done: '✓',
}

const statusColors = {
  todo: 'text-gray-500',
  in_progress: 'text-blue-500',
  review: 'text-yellow-500',
  done: 'text-green-500',
}

function TaskCardComponent({ task }: TaskCardProps) {
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

  // Check if task is overdue
  const isOverdue = useMemo(() => {
    if (!task.dueDate) return false
    const dueDate = new Date(task.dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return dueDate < today && task.status !== 'done'
  }, [task.dueDate, task.status])

  // Calculate subtask progress
  const subtaskProgress = useMemo(() => {
    if (!task.subtasks || task.subtasks.length === 0) return null
    const completed = task.subtasks.filter((st: any) => st.completed).length
    return { completed, total: task.subtasks.length }
  }, [task.subtasks])

  return (
    <>
      <TaskContextMenu task={task} onEdit={() => setIsEditModalOpen(true)}>
        <TooltipProvider>
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <div
              ref={setNodeRef}
              style={style}
              {...attributes}
              {...listeners}
              className={cn(
                'group rounded-lg bg-background/80 backdrop-blur-sm cursor-pointer',
                'border-l-[3px] shadow-sm hover:shadow-md transition-all duration-200',
                'hover:scale-[1.02] hover:bg-background relative',
                priorityColors[task.priority as keyof typeof priorityColors],
                isOverdue && 'border-l-red-600 bg-red-500/10',
                isDragging && 'opacity-50 rotate-2 scale-105'
              )}
              onClick={handleClick}
            >
              <div className="p-2">
                <div className="flex items-start gap-2">
                  <span className={cn(
                    'text-xs mt-0.5 font-bold',
                    statusColors[task.status as keyof typeof statusColors],
                    task.status === 'done' && 'line-through'
                  )}>
                    {statusIcons[task.status as keyof typeof statusIcons]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className={cn(
                        "text-xs font-medium truncate leading-relaxed flex-1",
                        task.status === 'done' && 'line-through opacity-60'
                      )}>
                        {task.title}
                      </p>
                      {isOverdue && (
                        <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
                      )}
                    </div>
                    
                    {/* Tags */}
                    {task.tags && task.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {task.tags.slice(0, 2).map((tag: string, index: number) => (
                          <span
                            key={index}
                            className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                        {task.tags.length > 2 && (
                          <span className="text-[9px] text-muted-foreground">+{task.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-1.5 mt-1">
                      {/* Priority dot */}
                      <div className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        priorityDots[task.priority as keyof typeof priorityDots]
                      )} />
                      
                      {/* Due date */}
                      {task.dueDate && (
                        <span className={cn(
                          "text-[10px] flex items-center gap-0.5",
                          isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground"
                        )}>
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(task.dueDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      
                      {/* Metadata indicators */}
                      <div className="flex items-center gap-1 ml-auto">
                        {/* Subtask progress */}
                        {subtaskProgress && (
                          <div className="flex items-center gap-0.5">
                            <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[9px] text-muted-foreground">
                              {subtaskProgress.completed}/{subtaskProgress.total}
                            </span>
                          </div>
                        )}
                        
                        {/* Comments */}
                        {task.comments && task.comments.length > 0 && (
                          <div className="flex items-center gap-0.5">
                            <MessageSquare className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[9px] text-muted-foreground">{task.comments.length}</span>
                          </div>
                        )}
                        
                        {/* Attachments */}
                        {task.attachments && task.attachments.length > 0 && (
                          <div className="flex items-center gap-0.5">
                            <Paperclip className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[9px] text-muted-foreground">{task.attachments.length}</span>
                          </div>
                        )}
                        
                        {/* Assignees - Just show count for now since we only have IDs */}
                        {task.assignedTo?.length > 0 && (
                          <div className="flex items-center gap-0.5">
                            <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-medium border border-background shadow-sm">
                              {task.assignedTo.length}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-sm p-3">
            <div className="space-y-2">
              <div>
                <p className="font-semibold text-sm">{task.title}</p>
                {task.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{task.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="font-medium">Status:</span>
                  <span className={statusColors[task.status as keyof typeof statusColors]}>
                    {task.status}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-medium">Priority:</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                    task.priority === 'urgent' && 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
                    task.priority === 'high' && 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
                    task.priority === 'medium' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
                    task.priority === 'low' && 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  )}>
                    {task.priority}
                  </span>
                </span>
              </div>
              {task.assignedTo && task.assignedTo.length > 0 && (
                <div className="text-xs">
                  <span className="font-medium">Assigned to: </span>
                  {task.assignedTo.length} user{task.assignedTo.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TaskContextMenu>

      <TaskEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        task={task}
      />
    </>
  )
}

export const TaskCard = memo(TaskCardComponent, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.task._id === nextProps.task._id &&
    prevProps.task.title === nextProps.task.title &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.priority === nextProps.task.priority &&
    prevProps.task.dueDate === nextProps.task.dueDate &&
    JSON.stringify(prevProps.task.assignedTo) === JSON.stringify(nextProps.task.assignedTo) &&
    JSON.stringify(prevProps.task.tags) === JSON.stringify(nextProps.task.tags)
  )
})
"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Clock, MessageSquare, Paperclip, User, GripVertical } from "lucide-react"
import { format, isAfter, isBefore, startOfDay } from "date-fns"
import { TaskStatus } from "./kanban-board"
import { useMemo } from "react"

interface Task {
  _id: string
  title: string
  description?: string
  status: TaskStatus
  priority: "low" | "medium" | "high" | "urgent"
  assignedTo?: string[]
  createdBy: string
  dueDate?: string
  tags?: string[]
  attachments?: string[]
  position: number
  createdAt: string
  updatedAt: string
  completedAt?: string
  creator?: {
    _id: string
    name: string
    externalId: string
  }
  assignees?: Array<{
    _id: string
    name: string
    externalId: string
  }>
  commentCount?: number
}

interface KanbanCardProps {
  task: Task
  isDragging?: boolean
}

const priorityConfig = {
  low: { label: "Low", color: "bg-gray-500" },
  medium: { label: "Medium", color: "bg-blue-500" },
  high: { label: "High", color: "bg-orange-500" },
  urgent: { label: "Urgent", color: "bg-red-500" },
}

export function KanbanCard({ task, isDragging }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task._id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const { isOverdue, isDueSoon } = useMemo(() => {
    if (!task.dueDate || task.status === "done") {
      return { isOverdue: false, isDueSoon: false }
    }
    
    const dueDate = new Date(task.dueDate)
    const now = new Date()
    const today = startOfDay(now)
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
    
    const overdue = isBefore(dueDate, today)
    const dueSoon = !overdue && isBefore(dueDate, twoDaysFromNow)
    
    return { isOverdue: overdue, isDueSoon: dueSoon }
  }, [task.dueDate, task.status])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "touch-manipulation select-none",
        (isDragging || isSortableDragging) && "opacity-50"
      )}
    >
      <Card
        className={cn(
          "group relative cursor-grab hover:shadow-md transition-all duration-200",
          "hover:ring-2 hover:ring-primary/20 hover:scale-[1.02]",
          "active:scale-[0.98] active:shadow-sm", // Touch feedback
          (isDragging || isSortableDragging) && "cursor-grabbing shadow-lg scale-105"
        )}
        {...attributes}
        {...listeners}
      >
        {/* Drag Handle */}
        <div
          className={cn(
            "absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none",
            "text-muted-foreground/50",
            "touch:opacity-100", // Always visible on touch devices
            (isDragging || isSortableDragging) && "opacity-100"
          )}
        >
          <GripVertical className="h-4 w-4 touch:h-5 touch:w-5" />
        </div>
        <CardHeader className="p-4 pb-3 pl-8 space-y-2">
          {/* Priority indicator */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm leading-tight line-clamp-2">
                {task.title}
              </h4>
            </div>
            <div
              className={cn(
                "w-2 h-2 rounded-full flex-shrink-0 mt-1.5",
                priorityConfig[task.priority].color
              )}
              title={priorityConfig[task.priority].label + " priority"}
            />
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs px-2 py-0"
                >
                  {tag}
                </Badge>
              ))}
              {task.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs px-2 py-0">
                  +{task.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="p-4 pt-0 space-y-3">
          {/* Description preview */}
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Meta information */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {/* Due date */}
            {task.dueDate && (
              <div
                className={cn(
                  "flex items-center gap-1",
                  isOverdue && "text-destructive font-medium",
                  isDueSoon && "text-orange-600 dark:text-orange-400"
                )}
              >
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(task.dueDate), "MMM d")}</span>
              </div>
            )}

            {/* Comments */}
            {task.commentCount !== undefined && task.commentCount > 0 && (
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                <span>{task.commentCount}</span>
              </div>
            )}

            {/* Attachments */}
            {task.attachments && task.attachments.length > 0 && (
              <div className="flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                <span>{task.attachments.length}</span>
              </div>
            )}
          </div>

          {/* Assignees */}
          {task.assignees && task.assignees.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="flex -space-x-2">
                {task.assignees.slice(0, 3).map((assignee) => (
                  <Avatar
                    key={assignee._id}
                    className="h-6 w-6 border-2 border-background"
                  >
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${assignee.name}`}
                      alt={assignee.name}
                    />
                    <AvatarFallback className="text-xs">
                      {assignee.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {task.assignees.length > 3 && (
                <Badge variant="secondary" className="h-6 px-2">
                  +{task.assignees.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
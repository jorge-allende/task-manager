"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Clock, MessageSquare, Paperclip, User, GripVertical, Link2, FileText } from "lucide-react"
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
  tagDetails?: Array<{
    name: string
    color: string
  }>
  attachments?: string[]
  links?: Array<{
    url: string
    title: string
    favicon?: string
  }>
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
  onClick?: () => void
}

const priorityConfig = {
  low: { label: "Low", bgColor: "bg-gray-100 dark:bg-gray-800", textColor: "text-gray-700 dark:text-gray-300" },
  medium: { label: "Medium", bgColor: "bg-blue-100 dark:bg-blue-900/30", textColor: "text-blue-700 dark:text-blue-300" },
  high: { label: "High", bgColor: "bg-orange-100 dark:bg-orange-900/30", textColor: "text-orange-700 dark:text-orange-300" },
  urgent: { label: "Urgent", bgColor: "bg-red-100 dark:bg-red-900/30", textColor: "text-red-700 dark:text-red-300" },
}

const statusConfig = {
  todo: { label: "Not Started", color: "bg-blue-500", textColor: "text-blue-500" },
  in_progress: { label: "In Progress", color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-500" },
  review: { label: "In Review", color: "bg-purple-500", textColor: "text-purple-600 dark:text-purple-500" },
  done: { label: "Completed", color: "bg-green-500", textColor: "text-green-600 dark:text-green-500" },
}

// Tag color configuration - you can customize these colors based on your design system
export const tagColorConfig: Record<string, { bg: string; text: string }> = {
  // Development related
  "bug": { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300" },
  "feature": { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300" },
  "enhancement": { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300" },
  "documentation": { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300" },
  
  // Status related
  "urgent": { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300" },
  "blocked": { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300" },
  "waiting": { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300" },
  
  // Team related
  "frontend": { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300" },
  "backend": { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300" },
  "design": { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-300" },
  "qa": { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-300" },
  
  // Default fallback
  "default": { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300" },
}

// Helper function to get tag color
export const getTagColor = (tag: string, color?: string): { bg: string; text: string; style?: React.CSSProperties } => {
  // If a specific color is provided, use it
  if (color) {
    // If it's a hex color, convert to Tailwind classes
    if (color.startsWith('#')) {
      return {
        bg: 'bg-opacity-20',
        text: 'text-opacity-90',
        style: { backgroundColor: color + '20', color: color }
      }
    }
    // If it's already a Tailwind class, use predefined config
    const normalizedTag = tag.toLowerCase()
    return tagColorConfig[normalizedTag] || tagColorConfig.default
  }
  
  // Fallback to tag name-based colors
  const normalizedTag = tag.toLowerCase()
  return tagColorConfig[normalizedTag] || tagColorConfig.default
}

export function KanbanCard({ task, isDragging, onClick }: KanbanCardProps) {
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

  const statusInfo = statusConfig[task.status] || statusConfig.todo
  
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
          "group relative cursor-pointer hover:shadow-sm transition-all duration-200 border-muted/50 min-h-[240px] bg-background py-0 gap-0",
          (isDragging || isSortableDragging) && "cursor-grabbing shadow-lg"
        )}
        {...attributes}
        {...listeners}
        onClick={(e) => {
          // Only trigger click if not dragging and not clicking on the drag handle
          if (!isDragging && !isSortableDragging && onClick) {
            e.stopPropagation()
            onClick()
          }
        }}
      >
        <CardContent className="p-4 h-full flex flex-col overflow-hidden">
          {/* Tags - top section */}
          <div className="flex flex-wrap gap-2 mb-3">
            {((task.tagDetails && task.tagDetails.length > 0) || (task.tags && task.tags.length > 0)) ? (
              <>
                {(task.tagDetails || task.tags || []).slice(0, 2).map((tag, index) => {
                  const tagName = typeof tag === 'string' ? tag : tag.name
                  const tagColor = typeof tag === 'string' 
                    ? getTagColor(tag) 
                    : getTagColor(tag.name, tag.color)
                  
                  return (
                    <Badge
                      key={tagName + index}
                      className={cn(
                        "text-sm px-2.5 py-1.5 font-normal border-0",
                        !tagColor.style && tagColor.bg,
                        !tagColor.style && tagColor.text
                      )}
                      style={tagColor.style}
                    >
                      {tagName}
                    </Badge>
                  )
                })}
                {((task.tagDetails?.length || task.tags?.length || 0) > 2) && (
                  <Badge 
                    variant="secondary" 
                    className="text-sm px-2.5 py-1.5 font-normal"
                  >
                    +{(task.tagDetails?.length || task.tags?.length || 0) - 2}
                  </Badge>
                )}
              </>
            ) : null}
          </div>

          {/* Title */}
          <h4 className="font-semibold text-lg leading-tight line-clamp-2 mb-2">
            {task.title}
          </h4>

          {/* Description preview */}
          {task.description && (
            <p className="text-base text-muted-foreground line-clamp-3 mb-3">
              {task.description}
            </p>
          )}

          {/* Spacer to push bottom content down */}
          <div className="flex-1" />

          {/* Assignees section - full width row */}
          {task.assignees && task.assignees.length > 0 && (
            <div className="flex items-center justify-between mb-3 py-2">
              <span className="text-sm font-medium text-muted-foreground">Assignees:</span>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {task.assignees.slice(0, 3).map((assignee) => (
                    <Avatar
                      key={assignee._id}
                      className="h-8 w-8 border-2 border-background"
                    >
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${assignee.name}`}
                        alt={assignee.name}
                      />
                      <AvatarFallback className="text-sm font-medium">
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
                  <Badge variant="secondary" className="h-7 px-2 text-sm font-medium">
                    +{task.assignees.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Date and priority row */}
          <div className="flex items-center justify-between mb-3">
            {/* Due date */}
            {task.dueDate ? (
              <div
                className={cn(
                  "flex items-center gap-1.5 text-sm",
                  isOverdue && "text-destructive font-semibold",
                  isDueSoon && "text-orange-600 dark:text-orange-400",
                  !isOverdue && !isDueSoon && "text-muted-foreground"
                )}
              >
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(task.dueDate), "dd MMM yyyy")}</span>
              </div>
            ) : (
              <div />
            )}

            {/* Priority badge */}
            <Badge 
              className={cn(
                "text-sm font-medium px-3 py-1 rounded-full",
                priorityConfig[task.priority].bgColor,
                priorityConfig[task.priority].textColor,
                "border-0"
              )}
            >
              {priorityConfig[task.priority].label}
            </Badge>
          </div>

          {/* Metadata section - always at bottom */}
          {((task.commentCount !== undefined && task.commentCount > 0) || 
            (task.attachments && task.attachments.length > 0) || 
            (task.links && task.links.length > 0)) && (
            <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground pt-4 border-t">
              {/* Comments */}
              {task.commentCount !== undefined && task.commentCount > 0 && (
                <>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    <span>{task.commentCount} {task.commentCount === 1 ? 'Comment' : 'Comments'}</span>
                  </div>
                  {((task.attachments && task.attachments.length > 0) || 
                    (task.links && task.links.length > 0)) && (
                    <span className="text-muted-foreground/50">•</span>
                  )}
                </>
              )}

              {/* Attachments/Files */}
              {task.attachments && task.attachments.length > 0 && (
                <>
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    <span>{task.attachments.length} {task.attachments.length === 1 ? 'File' : 'Files'}</span>
                  </div>
                  {(task.links && task.links.length > 0) && (
                    <span className="text-muted-foreground/50">•</span>
                  )}
                </>
              )}

              {/* Links */}
              {task.links && task.links.length > 0 && (
                <div className="flex items-center gap-1">
                  <Link2 className="h-4 w-4" />
                  <span>{task.links.length} {task.links.length === 1 ? 'Link' : 'Links'}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
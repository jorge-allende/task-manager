'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  Trash2,
  Copy,
  Calendar,
  Flag,
  Users,
  Archive,
  MoreHorizontal,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface TaskContextMenuProps {
  children: React.ReactNode
  task: any
  onEdit?: () => void
}

const statusOptions = [
  { value: 'todo', label: 'To Do', icon: Circle, color: 'text-gray-500' },
  { value: 'in_progress', label: 'In Progress', icon: Clock, color: 'text-blue-500' },
  { value: 'review', label: 'Review', icon: Eye, color: 'text-yellow-500' },
  { value: 'done', label: 'Done', icon: CheckCircle2, color: 'text-green-500' },
]

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'text-blue-500' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-500' },
  { value: 'high', label: 'High', color: 'text-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-500' },
]

export function TaskContextMenu({ children, task, onEdit }: TaskContextMenuProps) {
  const { toast } = useToast()
  const updateTask = useMutation(api.tasks.update)
  const deleteTask = useMutation(api.tasks.deleteTask)
  const duplicateTask = useMutation(api.tasks.create)

  const handleStatusChange = async (status: string) => {
    try {
      await updateTask({
        id: task._id as Id<"tasks">,
        status: status as "todo" | "in_progress" | "review" | "done",
      })
      toast({
        title: "Status updated",
        description: `Task status changed to ${status}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive",
      })
    }
  }

  const handlePriorityChange = async (priority: string) => {
    try {
      await updateTask({
        id: task._id as Id<"tasks">,
        priority: priority as "low" | "medium" | "high" | "urgent",
      })
      toast({
        title: "Priority updated",
        description: `Task priority changed to ${priority}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update task priority",
        variant: "destructive",
      })
    }
  }

  const handleDuplicate = async () => {
    try {
      await duplicateTask({
        workspaceId: task.workspaceId,
        columnId: task.columnId,
        title: `${task.title} (Copy)`,
        description: task.description,
        priority: task.priority,
        assignedTo: task.assignedTo,
        tags: task.tags,
        dueDate: task.dueDate,
      })
      toast({
        title: "Task duplicated",
        description: "A copy of the task has been created",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to duplicate task",
        variant: "destructive",
      })
    }
  }

  const handleArchive = async () => {
    try {
      // Archive functionality is not available in the current API
      // Just mark as done for now
      await updateTask({
        id: task._id as Id<"tasks">,
        status: "done",
      })
      toast({
        title: "Task completed",
        description: "Task has been marked as done",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to archive task",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    try {
      await deleteTask({
        id: task._id as Id<"tasks">,
      })
      toast({
        title: "Task deleted",
        description: "Task has been permanently deleted",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      })
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel>Quick Actions</ContextMenuLabel>
        
        <ContextMenuSeparator />
        
        {/* Status Change */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Change Status
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {statusOptions.map((option) => {
              const Icon = option.icon
              return (
                <ContextMenuItem
                  key={option.value}
                  onClick={() => handleStatusChange(option.value)}
                  className={cn(
                    task.status === option.value && "bg-accent"
                  )}
                >
                  <Icon className={cn("mr-2 h-4 w-4", option.color)} />
                  {option.label}
                </ContextMenuItem>
              )
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Priority Change */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Flag className="mr-2 h-4 w-4" />
            Change Priority
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {priorityOptions.map((option) => (
              <ContextMenuItem
                key={option.value}
                onClick={() => handlePriorityChange(option.value)}
                className={cn(
                  task.priority === option.value && "bg-accent"
                )}
              >
                <Flag className={cn("mr-2 h-4 w-4", option.color)} />
                {option.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        {/* Edit */}
        {onEdit && (
          <ContextMenuItem onClick={onEdit}>
            <MoreHorizontal className="mr-2 h-4 w-4" />
            Edit Details
          </ContextMenuItem>
        )}

        {/* Duplicate */}
        <ContextMenuItem onClick={handleDuplicate}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </ContextMenuItem>

        {/* Archive */}
        {!task.isArchived && (
          <ContextMenuItem onClick={handleArchive}>
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {/* Delete */}
        <ContextMenuItem
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
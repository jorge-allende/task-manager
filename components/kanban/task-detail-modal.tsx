"use client"

import * as React from "react"
import { format, isAfter, isBefore, startOfDay, formatDistanceToNow } from "date-fns"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { useAuth } from "@clerk/nextjs"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Clock, 
  Archive, 
  Edit2, 
  MoreVertical,
  MessageSquare,
  Send,
  Trash2,
  Check,
  X,
  Paperclip,
  Link,
  Users
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { TaskEditModal } from "./task-edit-modal"
import { AttachmentsSection } from "@/components/attachments/attachments-section"
import { LinksSection } from "@/components/links/links-section"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { getTagColor } from "./kanban-card"

interface Task {
  _id: string
  workspaceId: Id<"workspaces">
  title: string
  description?: string
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

interface TaskDetailModalProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
  onEdit: () => void
}

const priorityConfig = {
  low: { label: "Low", color: "bg-gray-500", textColor: "text-gray-600 dark:text-gray-400" },
  medium: { label: "Medium", color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400" },
  high: { label: "High", color: "bg-orange-500", textColor: "text-orange-600 dark:text-orange-400" },
  urgent: { label: "Urgent", color: "bg-red-500", textColor: "text-red-600 dark:text-red-400" },
}

// Animation variants for smooth tab transitions
const tabContentVariants = {
  hidden: {
    opacity: 0,
    x: -10,
  },
  visible: {
    opacity: 1,
    x: 0,
  },
  exit: {
    opacity: 0,
    x: 10,
  }
}


export function TaskDetailModal({ task, isOpen, onClose, onEdit }: TaskDetailModalProps) {
  // Updated layout with compact spacing and removed centering
  const { toast } = useToast()
  const { userId } = useAuth()
  const archiveTask = useMutation(api.tasks.archive)
  const createComment = useMutation(api.comments.create)
  const updateComment = useMutation(api.comments.update)
  const deleteCommentMutation = useMutation(api.comments.deleteComment)
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)
  const [commentText, setCommentText] = React.useState("")
  const [isSubmittingComment, setIsSubmittingComment] = React.useState(false)
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = React.useState("")
  const [deletingCommentId, setDeletingCommentId] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState<"comments" | "attachments" | "links" | "details">("comments")

  // Reset tab when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab("comments")
    }
  }, [isOpen])

  // Fetch comments for the task
  const comments = useQuery(
    api.comments.list,
    task ? { taskId: task._id as Id<"tasks"> } : "skip"
  )

  // Calculate due date status
  const { isOverdue, isDueSoon } = React.useMemo(() => {
    if (!task?.dueDate) {
      return { isOverdue: false, isDueSoon: false }
    }
    
    const dueDate = new Date(task.dueDate)
    const now = new Date()
    const today = startOfDay(now)
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
    
    const overdue = isBefore(dueDate, today)
    const dueSoon = !overdue && isBefore(dueDate, twoDaysFromNow)
    
    return { isOverdue: overdue, isDueSoon: dueSoon }
  }, [task?.dueDate])

  const handleArchive = async () => {
    if (!task) return

    try {
      await archiveTask({ id: task._id as Id<"tasks"> })
      toast({
        title: "Task archived",
        description: "The task has been archived successfully.",
      })
      onClose()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to archive task. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleEdit = () => {
    setIsEditModalOpen(true)
  }

  const handleEditModalClose = () => {
    setIsEditModalOpen(false)
  }

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || !task) return

    setIsSubmittingComment(true)
    try {
      await createComment({
        taskId: task._id as Id<"tasks">,
        workspaceId: task.workspaceId,
        content: commentText,
      })
      
      toast({
        title: "Comment added",
        description: "Your comment has been posted.",
      })
      setCommentText("")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleCommentEdit = (commentId: string, currentContent: string) => {
    setEditingCommentId(commentId)
    setEditingCommentText(currentContent)
  }

  const handleCommentEditCancel = () => {
    setEditingCommentId(null)
    setEditingCommentText("")
  }

  const handleCommentEditSave = async (commentId: string) => {
    if (!editingCommentText.trim()) return

    try {
      await updateComment({
        commentId: commentId as Id<"comments">,
        content: editingCommentText,
      })
      
      toast({
        title: "Comment updated",
        description: "Your comment has been updated.",
      })
      setEditingCommentId(null)
      setEditingCommentText("")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update comment. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleCommentDelete = async (commentId: string) => {
    try {
      await deleteCommentMutation({
        commentId: commentId as Id<"comments">,
      })
      
      toast({
        title: "Comment deleted",
        description: "The comment has been deleted.",
      })
      setDeletingCommentId(null)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete comment. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (!task) return null

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          className="task-detail-modal w-full max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
        >
          {/* Enhanced Header Section */}
          <div className="px-6 py-5 border-b bg-background/50 backdrop-blur-sm">
            {/* Title row */}
            <div className="flex items-center justify-between gap-4 mb-4">
              <DialogTitle className="text-2xl font-semibold leading-tight">
                {task.title}
              </DialogTitle>
              
              {/* Edit button - positioned next to close button */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleEdit}
                  className="h-9 w-9 flex-shrink-0"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Metadata row - centered below title */}
            <div className="flex items-center justify-center gap-4 text-sm whitespace-nowrap overflow-x-auto px-4">
              {/* Priority */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-muted-foreground font-medium">Priority:</span>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-2 h-2 rounded-full", priorityConfig[task.priority].color)} />
                  <Badge 
                    className={cn(
                      "text-xs font-medium border-0",
                      "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
                      task.priority === "medium" && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                      task.priority === "high" && "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
                      task.priority === "urgent" && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    )}
                  >
                    {priorityConfig[task.priority].label}
                  </Badge>
                </div>
              </div>
              
              {/* Due Date */}
              {task.dueDate && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-muted-foreground font-medium">Due date:</span>
                  <span className={cn(
                    "text-sm font-medium",
                    isOverdue ? "text-destructive" : 
                    isDueSoon ? "text-orange-600 dark:text-orange-400" : 
                    "text-foreground"
                  )}>
                    {format(new Date(task.dueDate), "MMM d, yyyy")}
                    {isOverdue && " (Overdue)"}
                    {isDueSoon && " (Due soon)"}
                  </span>
                </div>
              )}
              
              {/* Tags */}
              {((task.tagDetails && task.tagDetails.length > 0) || (task.tags && task.tags.length > 0)) && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-muted-foreground font-medium">Tags:</span>
                  <div className="flex gap-1">
                    {(task.tagDetails || task.tags || []).slice(0, 3).map((tag, index) => {
                      const tagName = typeof tag === 'string' ? tag : tag.name
                      const tagColor = typeof tag === 'string' 
                        ? getTagColor(tag) 
                        : getTagColor(tag.name, tag.color)
                      
                      return (
                        <Badge
                          key={tagName + index}
                          className={cn(
                            "text-xs px-2 py-0.5 font-normal border-0",
                            !tagColor.style && tagColor.bg,
                            !tagColor.style && tagColor.text
                          )}
                          style={tagColor.style}
                        >
                          {tagName}
                        </Badge>
                      )
                    })}
                    {((task.tagDetails?.length || task.tags?.length || 0) > 3) && (
                      <Badge 
                        variant="secondary" 
                        className="text-xs px-2 py-0.5 font-normal"
                      >
                        +{(task.tagDetails?.length || task.tags?.length || 0) - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-6 py-4 space-y-3">
              {/* Description Section */}
              <div className="bg-muted/30 border rounded-lg p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Description</h3>
                {task.description ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {task.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground/70 italic">
                    No description provided
                  </p>
                )}
              </div>

              {/* Animated Tabbed Interface */}
              <div className="w-full flex justify-center">
                <div className="bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-1 gap-1">
                  <button
                    onClick={() => setActiveTab("comments")}
                    className={cn(
                      "inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-all duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
                      activeTab === "comments" 
                        ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30" 
                        : "text-foreground dark:text-muted-foreground hover:bg-background/50"
                    )}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Comments
                    {task.commentCount !== undefined && task.commentCount > 0 && (
                      <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                        {task.commentCount}
                      </Badge>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab("attachments")}
                    className={cn(
                      "inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-all duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
                      activeTab === "attachments" 
                        ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30" 
                        : "text-foreground dark:text-muted-foreground hover:bg-background/50"
                    )}
                  >
                    <Paperclip className="h-4 w-4 mr-1" />
                    Attachments
                  </button>
                  <button
                    onClick={() => setActiveTab("links")}
                    className={cn(
                      "inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-all duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
                      activeTab === "links" 
                        ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30" 
                        : "text-foreground dark:text-muted-foreground hover:bg-background/50"
                    )}
                  >
                    <Link className="h-4 w-4 mr-1" />
                    Links
                  </button>
                  <button
                    onClick={() => setActiveTab("details")}
                    className={cn(
                      "inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-all duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
                      activeTab === "details" 
                        ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30" 
                        : "text-foreground dark:text-muted-foreground hover:bg-background/50"
                    )}
                  >
                    <Users className="h-4 w-4 mr-1" />
                    Details
                  </button>
                </div>
              </div>

              {/* Animated Tab Content */}
              <div className="mt-4 relative overflow-hidden h-[400px]">
                  <AnimatePresence mode="wait">
                    {activeTab === "comments" && (
                      <motion.div
                        key="comments"
                        variants={tabContentVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ 
                          duration: 0.2, 
                          ease: "easeInOut"
                        }}
                        className="space-y-3 h-full overflow-y-auto"
                      >
                        <div className="bg-background border rounded-lg p-4 h-full flex flex-col">
                          <div className="space-y-4 mb-4 flex-1 overflow-y-auto pr-2">
                            {comments === undefined ? (
                              // Loading state
                              <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                  <div key={i} className="flex gap-3">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <div className="flex-1 space-y-2">
                                      <Skeleton className="h-3 w-24" />
                                      <Skeleton className="h-12 w-full" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : comments.length === 0 ? (
                              // Empty state
                              <p className="text-sm text-muted-foreground text-center py-8">
                                No comments yet. Be the first to comment!
                              </p>
                            ) : (
                              // Comments list
                              comments.map((comment) => (
                                <div key={comment._id} className="flex gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                                  {/* User avatar */}
                                  <Avatar className="h-8 w-8 flex-shrink-0">
                                    <AvatarImage
                                      src={comment.user ? `https://api.dicebear.com/7.x/initials/svg?seed=${comment.user.name}` : undefined}
                                      alt={comment.user?.name || "User"}
                                    />
                                    <AvatarFallback className="text-xs">
                                      {comment.user?.name
                                        ?.split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .toUpperCase()
                                        .slice(0, 2) || "U"}
                                    </AvatarFallback>
                                  </Avatar>

                                  {/* Comment content */}
                                  <div className="flex-1 space-y-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium">
                                        {comment.user?.name || "Unknown User"}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                        {comment.isEdited && " (edited)"}
                                      </span>
                                      
                                      {/* Actions for comment author */}
                                      {comment.user?.externalId === userId && (
                                        <div className="flex items-center gap-1 ml-auto">
                                          {editingCommentId !== comment._id && (
                                            <>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => handleCommentEdit(comment._id, comment.content)}
                                              >
                                                <Edit2 className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-destructive hover:text-destructive"
                                                onClick={() => setDeletingCommentId(comment._id)}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* Comment text or edit form */}
                                    {editingCommentId === comment._id ? (
                                      <div className="space-y-2">
                                        <Textarea
                                          value={editingCommentText}
                                          onChange={(e) => setEditingCommentText(e.target.value)}
                                          className="resize-none text-sm"
                                          rows={3}
                                          autoFocus
                                        />
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => handleCommentEditSave(comment._id)}
                                            disabled={!editingCommentText.trim()}
                                          >
                                            <Check className="h-3 w-3 mr-1" />
                                            Save
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleCommentEditCancel}
                                          >
                                            <X className="h-3 w-3 mr-1" />
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                        {comment.content}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Comment input */}
                          <form onSubmit={handleCommentSubmit} className="flex flex-col gap-3 border-t pt-4">
                            <Textarea
                              placeholder="Add a comment..."
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              className="resize-none text-sm min-h-[80px]"
                              rows={3}
                              disabled={isSubmittingComment}
                            />
                            <Button 
                              type="submit" 
                              size="sm"
                              className="self-end"
                              disabled={!commentText.trim() || isSubmittingComment}
                            >
                              <Send className="h-3 w-3 mr-2" />
                              Send
                            </Button>
                          </form>
                        </div>
                      </motion.div>
                    )}

                    {activeTab === "attachments" && (
                      <motion.div
                        key="attachments"
                        variants={tabContentVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ 
                          duration: 0.2, 
                          ease: "easeInOut"
                        }}
                        className="space-y-3 h-full overflow-y-auto"
                      >
                        <div className="bg-background border rounded-lg p-4 h-full overflow-y-auto">
                          <AttachmentsSection
                            taskId={task._id as Id<"tasks">}
                            currentAttachments={task.attachments || []}
                          />
                        </div>
                      </motion.div>
                    )}

                    {activeTab === "links" && (
                      <motion.div
                        key="links"
                        variants={tabContentVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ 
                          duration: 0.2, 
                          ease: "easeInOut"
                        }}
                        className="space-y-3 h-full overflow-y-auto"
                      >
                        <div className="bg-background border rounded-lg p-4 h-full overflow-y-auto">
                          <LinksSection
                            taskId={task._id as Id<"tasks">}
                            currentLinks={task.links || []}
                          />
                        </div>
                      </motion.div>
                    )}

                    {activeTab === "details" && (
                      <motion.div
                        key="details"
                        variants={tabContentVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ 
                          duration: 0.2, 
                          ease: "easeInOut"
                        }}
                        className="space-y-3 h-full overflow-y-auto"
                      >
                        <div className="bg-background border rounded-lg p-4 h-full overflow-y-auto">
                          <div className="space-y-6">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Task Information</h3>
                            
                            {/* Task metadata */}
                            <div className="space-y-4">
                              {/* Assignees */}
                              {task.assignees && task.assignees.length > 0 && (
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Assigned to</span>
                                  </div>
                                  <div className="ml-6 flex flex-wrap gap-2">
                                    {task.assignees.map((assignee) => (
                                      <div key={assignee._id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                                        <Avatar className="h-6 w-6">
                                          <AvatarImage
                                            src={`https://api.dicebear.com/7.x/initials/svg?seed=${assignee.name}`}
                                            alt={assignee.name}
                                          />
                                          <AvatarFallback className="text-xs">
                                            {assignee.name
                                              ?.split(" ")
                                              .map((n) => n[0])
                                              .join("")
                                              .toUpperCase()
                                              .slice(0, 2) || "U"}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm">{assignee.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Created By */}
                              {task.creator && (
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Created by</span>
                                  </div>
                                  <div className="ml-6 flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 w-fit">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage
                                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${task.creator.name}`}
                                        alt={task.creator.name}
                                      />
                                      <AvatarFallback className="text-xs">
                                        {task.creator.name
                                          ?.split(" ")
                                          .map((n) => n[0])
                                          .join("")
                                          .toUpperCase()
                                          .slice(0, 2) || "U"}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm">{task.creator.name}</span>
                                  </div>
                                </div>
                              )}
                              
                              {/* Created On */}
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">Created on</span>
                                </div>
                                <div className="ml-6 text-sm text-muted-foreground">
                                  {format(new Date(task.createdAt), "EEEE, MMMM do, yyyy 'at' h:mm a")}
                                  <span className="block text-xs mt-1">
                                    {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Last Updated */}
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">Last updated</span>
                                </div>
                                <div className="ml-6 text-sm text-muted-foreground">
                                  {format(new Date(task.updatedAt), "EEEE, MMMM do, yyyy 'at' h:mm a")}
                                  <span className="block text-xs mt-1">
                                    {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Completion Date */}
                              {task.completedAt && (
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-green-600" />
                                    <span className="text-sm font-medium">Completed on</span>
                                  </div>
                                  <div className="ml-6 text-sm text-muted-foreground">
                                    {format(new Date(task.completedAt), "EEEE, MMMM do, yyyy 'at' h:mm a")}
                                    <span className="block text-xs mt-1">
                                      {formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <TaskEditModal
        isOpen={isEditModalOpen}
        onClose={handleEditModalClose}
        task={task}
      />

      {/* Delete Comment Confirmation */}
      <AlertDialog open={!!deletingCommentId} onOpenChange={() => setDeletingCommentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCommentId && handleCommentDelete(deletingCommentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { CalendarIcon, Loader2, Save, X, Users, MessageSquare, Paperclip, Link, Edit2 } from "lucide-react"
import { format } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { getTagColor } from "@/components/kanban/kanban-card"
import { TagCombobox } from "@/components/ui/tag-combobox"
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

// Form validation schema
const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  description: z.string().max(500, "Description is too long").optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assignedTo: z.array(z.string()).optional(),
  dueDate: z.date().optional(),
  tags: z.array(z.string()).optional(),
})

type TaskFormValues = z.infer<typeof taskFormSchema>

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

interface TaskEditModalProps {
  isOpen: boolean
  onClose: () => void
  task: any
}

export function TaskEditModal({ isOpen, onClose, task }: TaskEditModalProps) {
  const { toast } = useToast()
  const updateTask = useMutation(api.tasks.update)
  const createTag = useMutation(api.tags.createTag)
  const [activeTab, setActiveTab] = React.useState("basic")
  
  // Fetch workspace members for assignee selection
  const members = useQuery(api.workspaceMembers.list, {
    workspaceId: task?.workspaceId,
    paginationOpts: { numItems: 100, cursor: null },
  })

  // Fetch workspace tags
  const workspaceTags = useQuery(api.tags.getTags, {
    workspaceId: task?.workspaceId,
  })

  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [colorPickerOpen, setColorPickerOpen] = React.useState(false)
  const [newTagName, setNewTagName] = React.useState("")
  const [selectedColor, setSelectedColor] = React.useState("#3b82f6")

  // Reset tab when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab("basic")
    }
  }, [isOpen])

  // Predefined color palette
  const colorPalette = [
    { name: "Red", value: "#ef4444" },
    { name: "Orange", value: "#f97316" },
    { name: "Amber", value: "#f59e0b" },
    { name: "Yellow", value: "#eab308" },
    { name: "Lime", value: "#84cc16" },
    { name: "Green", value: "#22c55e" },
    { name: "Emerald", value: "#10b981" },
    { name: "Teal", value: "#14b8a6" },
    { name: "Cyan", value: "#06b6d4" },
    { name: "Sky", value: "#0ea5e9" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Indigo", value: "#6366f1" },
    { name: "Violet", value: "#8b5cf6" },
    { name: "Purple", value: "#a855f7" },
    { name: "Fuchsia", value: "#d946ef" },
    { name: "Pink", value: "#ec4899" },
  ]

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      priority: task?.priority || "medium",
      assignedTo: task?.assignedTo || [],
      tags: task?.tags || [],
      dueDate: task?.dueDate ? new Date(task.dueDate) : undefined,
    },
  })

  // Reset form when task changes
  React.useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        assignedTo: task.assignedTo || [],
        tags: task.tags || [],
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
      })
    }
  }, [task, form])

  const onSubmit = async (values: TaskFormValues) => {
    if (!task) return

    try {
      setIsSubmitting(true)
      
      await updateTask({
        id: task._id,
        title: values.title,
        description: values.description,
        priority: values.priority,
        assignedTo: values.assignedTo?.map(id => id as Id<"users">),
        dueDate: values.dueDate?.toISOString(),
        tags: values.tags,
      })

      toast({
        title: "Task updated",
        description: "Your task has been updated successfully.",
      })
      
      onClose()
    } catch (error) {
      console.error("Failed to update task:", error)
      toast({
        title: "Error",
        description: "Failed to update task. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateTag = async (name: string) => {
    if (!task?.workspaceId) return
    setNewTagName(name)
    setColorPickerOpen(true)
  }

  const handleConfirmCreateTag = async () => {
    if (!task?.workspaceId) return
    
    try {
      await createTag({
        workspaceId: task.workspaceId,
        name: newTagName,
        color: selectedColor,
      })
      
      toast({
        title: "Tag created",
        description: `Tag "${newTagName}" has been created.`,
      })
      
      // Add the new tag to the current selection
      const currentTags = form.getValues("tags") || []
      form.setValue("tags", [...currentTags, newTagName])
      
      setColorPickerOpen(false)
      setNewTagName("")
      setSelectedColor("#3b82f6")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create tag",
        variant: "destructive",
      })
    }
  }

  // Calculate due date status for display
  const { isOverdue, isDueSoon } = React.useMemo(() => {
    if (!task?.dueDate) {
      return { isOverdue: false, isDueSoon: false }
    }
    
    const dueDate = new Date(task.dueDate)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
    
    const overdue = dueDate < today
    const dueSoon = !overdue && dueDate < twoDaysFromNow
    
    return { isOverdue: overdue, isDueSoon: dueSoon }
  }, [task?.dueDate])

  if (!task) return null

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="task-edit-modal w-full max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Enhanced Header Section */}
        <div className="px-6 py-5 bg-background/50 backdrop-blur-sm">
          {/* Title row */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <DialogTitle className="text-2xl font-semibold leading-tight">
              Edit: {task.title}
            </DialogTitle>
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
                          "text-xs px-2 py-0.5 font-normal",
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
          <div className="px-6 py-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <div className="w-full flex justify-center mb-6">
                    <TabsList className="bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-1 gap-1">
                      <TabsTrigger value="basic" className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap">
                        <Edit2 className="h-4 w-4 mr-1" />
                        Basic Info
                      </TabsTrigger>
                      <TabsTrigger value="assignment" className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap">
                        <Users className="h-4 w-4 mr-1" />
                        Assignment
                      </TabsTrigger>
                      <TabsTrigger value="attachments" className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap">
                        <Paperclip className="h-4 w-4 mr-1" />
                        Attachments
                      </TabsTrigger>
                      <TabsTrigger value="links" className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap">
                        <Link className="h-4 w-4 mr-1" />
                        Links
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <AnimatePresence mode="wait">
                    <TabsContent value="basic" className="mt-0">
                      <motion.div
                        key="basic"
                        variants={tabContentVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="bg-background rounded-lg p-6 space-y-6"
                      >
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Title</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter task title" 
                                  {...field} 
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Add a description..."
                                  className="resize-none"
                                  rows={4}
                                  {...field}
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                              <FormDescription>
                                Provide additional details about the task
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="priority"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Priority</FormLabel>
                                <Select 
                                  onValueChange={field.onChange} 
                                  defaultValue={field.value}
                                  disabled={isSubmitting}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select priority" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="low">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-gray-400" />
                                        Low
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="medium">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-blue-400" />
                                        Medium
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="high">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-orange-400" />
                                        High
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="urgent">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-red-400" />
                                        Urgent
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="tags"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tags</FormLabel>
                                <FormControl>
                                  <TagCombobox
                                    value={field.value || []}
                                    onChange={field.onChange}
                                    tags={workspaceTags || []}
                                    disabled={isSubmitting}
                                    placeholder="Select or search tags..."
                                    onCreateTag={handleCreateTag}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Select tags to categorize your task
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </motion.div>
                    </TabsContent>

                    <TabsContent value="assignment" className="mt-0">
                      <motion.div
                        key="assignment"
                        variants={tabContentVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="bg-background rounded-lg p-6 space-y-6"
                      >
                        <FormField
                          control={form.control}
                          name="assignedTo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Assignees</FormLabel>
                              <FormControl>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {members?.page.map((member) => (
                                    <label
                                      key={member.userId}
                                      className={cn(
                                        "flex items-center space-x-3 cursor-pointer p-3 rounded-md hover:bg-muted/50 border border-transparent hover:border-border/50 transition-all",
                                        isSubmitting && "cursor-not-allowed opacity-50"
                                      )}
                                    >
                                      <Checkbox
                                        checked={field.value?.includes(member.userId)}
                                        onCheckedChange={(checked) => {
                                          if (isSubmitting) return
                                          const currentValue = field.value || []
                                          if (checked) {
                                            field.onChange([...currentValue, member.userId])
                                          } else {
                                            field.onChange(
                                              currentValue.filter((id) => id !== member.userId)
                                            )
                                          }
                                        }}
                                        disabled={isSubmitting}
                                      />
                                      <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                          <AvatarFallback>
                                            {member.user?.name?.charAt(0) || "?"}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                          <span className="text-sm font-medium">
                                            {member.user?.name || "Unknown User"}
                                          </span>
                                          <Badge variant="outline" className="text-xs w-fit">
                                            {member.role}
                                          </Badge>
                                        </div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </FormControl>
                              <FormDescription>
                                Select team members to assign to this task
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="dueDate"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Due Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                      disabled={isSubmitting}
                                    >
                                      {field.value ? (
                                        format(field.value, "PPP")
                                      ) : (
                                        <span>Pick a date</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) => date < new Date()}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormDescription>
                                When should this task be completed?
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </motion.div>
                    </TabsContent>

                    <TabsContent value="attachments" className="mt-0">
                      <motion.div
                        key="attachments"
                        variants={tabContentVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="bg-background rounded-lg p-6"
                      >
                        <AttachmentsSection
                          taskId={task._id as Id<"tasks">}
                          currentAttachments={task.attachments || []}
                        />
                      </motion.div>
                    </TabsContent>

                    <TabsContent value="links" className="mt-0">
                      <motion.div
                        key="links"
                        variants={tabContentVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="bg-background rounded-lg p-6"
                      >
                        <LinksSection
                          taskId={task._id as Id<"tasks">}
                          currentLinks={task.links || []}
                        />
                      </motion.div>
                    </TabsContent>
                  </AnimatePresence>
                </Tabs>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>

    {/* Color Picker Dialog */}
    <AlertDialog open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Choose a color for "{newTagName}"</AlertDialogTitle>
          <AlertDialogDescription>
            Select a color to help visually identify this tag.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="grid grid-cols-4 gap-3 py-4">
          {colorPalette.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => setSelectedColor(color.value)}
              className={cn(
                "h-10 w-full rounded-md border-2 transition-all hover:scale-105",
                selectedColor === color.value
                  ? "border-foreground shadow-md"
                  : "border-transparent"
              )}
              style={{ backgroundColor: color.value }}
              aria-label={`Select ${color.name} color`}
            />
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-md border"
            style={{ backgroundColor: selectedColor }}
          />
          <span className="text-sm text-muted-foreground">
            Selected color: {colorPalette.find(c => c.value === selectedColor)?.name}
          </span>
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => {
            setColorPickerOpen(false)
            setNewTagName("")
            setSelectedColor("#3b82f6")
          }}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmCreateTag}>
            Create Tag
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { CalendarIcon, Loader2, Plus, X, Users, Paperclip, Link, Edit2, Upload, Trash2, Eye, Download } from "lucide-react"
import { format } from "date-fns"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { getTagColor } from "@/components/kanban/kanban-card"
import { TagCombobox } from "@/components/ui/tag-combobox"
import { LinkInput, TaskLink } from "@/components/links/link-input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  links: z.array(z.object({
    url: z.string(),
    title: z.string(),
    favicon: z.string().optional(),
  })).optional(),
})

type TaskFormValues = z.infer<typeof taskFormSchema>


const priorityConfig = {
  low: { label: "Low", color: "bg-gray-500", textColor: "text-gray-600 dark:text-gray-400" },
  medium: { label: "Medium", color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400" },
  high: { label: "High", color: "bg-orange-500", textColor: "text-orange-600 dark:text-orange-400" },
  urgent: { label: "Urgent", color: "bg-red-500", textColor: "text-red-600 dark:text-red-400" },
}

interface TaskCreateModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: Id<"workspaces">
}

export function TaskCreateModal({ 
  isOpen, 
  onClose, 
  workspaceId
}: TaskCreateModalProps) {
  const { toast } = useToast()
  const createTask = useMutation(api.tasks.create)
  const createTag = useMutation(api.tags.createTag)
  
  // Fetch workspace members for assignee selection
  const members = useQuery(api.workspaceMembers.list, {
    workspaceId,
    paginationOpts: { numItems: 100, cursor: null },
  })

  // Fetch workspace tags
  const workspaceTags = useQuery(api.tags.getTags, {
    workspaceId,
  })

  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [colorPickerOpen, setColorPickerOpen] = React.useState(false)
  const [newTagName, setNewTagName] = React.useState("")
  const [selectedColor, setSelectedColor] = React.useState("#3b82f6")
  const [activeTab, setActiveTab] = React.useState<"basic" | "assignment" | "attachments" | "links">("basic")
  const [attachments, setAttachments] = React.useState<File[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

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
      title: "",
      description: "",
      priority: "medium",
      assignedTo: [],
      tags: [],
      links: [],
    },
  })

  // Reset form and tab when modal opens
  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        title: "",
        description: "",
        priority: "medium",
        assignedTo: [],
        tags: [],
        links: [],
      })
      setActiveTab("basic")
      setAttachments([])
    }
  }, [isOpen, form])

  const onSubmit = async (values: TaskFormValues) => {
    try {
      setIsSubmitting(true)
      
      await createTask({
        workspaceId,
        title: values.title,
        description: values.description,
        priority: values.priority,
        assignedTo: values.assignedTo?.map(id => id as Id<"users">),
        dueDate: values.dueDate?.toISOString(),
        tags: values.tags,
        links: values.links,
      })

      toast({
        title: "Task created",
        description: "Your task has been created successfully.",
      })
      
      onClose()
    } catch (error) {
      console.error("Failed to create task:", error)
      toast({
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateTag = async (name: string) => {
    setNewTagName(name)
    setColorPickerOpen(true)
  }

  const handleConfirmCreateTag = async () => {
    try {
      await createTag({
        workspaceId,
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const newFiles = Array.from(files)
      setAttachments(prev => [...prev, ...newFiles])
      toast({
        title: "Files added",
        description: `${newFiles.length} file(s) added. They will be uploaded when you create the task.`,
      })
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handlePreviewFile = (file: File) => {
    // Create a URL for the file
    const fileUrl = URL.createObjectURL(file)
    
    // Check if it's an image
    if (file.type.startsWith('image/')) {
      // Open image in new tab
      window.open(fileUrl, '_blank')
    } else if (file.type === 'application/pdf') {
      // Open PDF in new tab
      window.open(fileUrl, '_blank')
    } else {
      // For other files, trigger download
      handleDownloadFile(file)
    }
  }

  const handleDownloadFile = (file: File) => {
    // Create a URL for the file
    const fileUrl = URL.createObjectURL(file)
    
    // Create a temporary anchor element and trigger download
    const a = document.createElement('a')
    a.href = fileUrl
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    // Clean up the URL
    URL.revokeObjectURL(fileUrl)
  }

  const getFileIcon = (file: File) => {
    // Return different icons based on file type
    if (file.type.startsWith('image/')) {
      return '🖼️'
    } else if (file.type === 'application/pdf') {
      return '📄'
    } else if (file.type.includes('word') || file.type.includes('document')) {
      return '📝'
    } else if (file.type.includes('sheet') || file.type.includes('excel')) {
      return '📊'
    } else if (file.type.includes('presentation') || file.type.includes('powerpoint')) {
      return '📽️'
    } else {
      return '📎'
    }
  }


  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[552px] sm:max-w-[552px] h-[715px] p-0 gap-0 flex flex-col">
        <Form {...form}>
          <form id="task-create-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "basic" | "assignment" | "attachments" | "links")} className="flex flex-col h-full">
              {/* Header Section */}
              <div className="px-6 pt-6 pb-4">
                {/* Title */}
                <DialogTitle className="text-center text-2xl font-semibold mb-2">
                  Create New Task
                </DialogTitle>
                
                {/* Description */}
                <DialogDescription className="text-center text-muted-foreground mb-6">
                  Add a new task to your workspace. Fill in the details below.
                </DialogDescription>

                {/* Tabs */}
                <div className="w-full px-3">
                  <TabsList className="!grid !grid-cols-4 !w-full gap-2">
                    <TabsTrigger value="basic" className="!flex items-center justify-center gap-1 px-1">
                      <Edit2 className="h-3.5 w-3.5" />
                      <span className="text-xs">Basic Info</span>
                    </TabsTrigger>
                    <TabsTrigger value="assignment" className="!flex items-center justify-center gap-1 px-1">
                      <Users className="h-3.5 w-3.5" />
                      <span className="text-xs">Assignment</span>
                    </TabsTrigger>
                    <TabsTrigger value="attachments" className="!flex items-center justify-center gap-1 px-1">
                      <Paperclip className="h-3.5 w-3.5" />
                      <span className="text-xs">Attachments</span>
                    </TabsTrigger>
                    <TabsTrigger value="links" className="!flex items-center justify-center gap-1 px-1">
                      <Link className="h-3.5 w-3.5" />
                      <span className="text-xs">Links</span>
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 px-6 pb-6 overflow-y-auto min-h-0">
                  <TabsContent value="basic" className="mt-0 space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Title</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter task title" 
                              {...field} 
                              disabled={isSubmitting}
                              className="h-10 border-muted/30 focus-visible:ring-1 focus-visible:ring-offset-0"
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
                          <FormLabel className="text-sm font-medium">Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Add a description..."
                              className="resize-none min-h-[100px] border-muted/30 focus-visible:ring-1 focus-visible:ring-offset-0"
                              rows={4}
                              {...field}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="text-sm font-medium">Due Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "justify-start text-left font-normal h-10",
                                      !field.value && "text-muted-foreground"
                                    )}
                                    disabled={isSubmitting}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date()}
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Priority</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                              disabled={isSubmitting}
                            >
                              <FormControl>
                                <SelectTrigger className="h-10">
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
                    </div>

                    <FormField
                      control={form.control}
                      name="tags"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Tags</FormLabel>
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="assignment" className="mt-0 space-y-4">
                    <FormField
                      control={form.control}
                      name="assignedTo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Assignees</FormLabel>
                          <FormControl>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {members?.page.map((member) => (
                                <label
                                  key={member.userId}
                                  className={cn(
                                    "flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-accent",
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
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      {/* User object doesn't have imageUrl */}
                                      <AvatarFallback>
                                        {member.user?.name?.charAt(0) || "?"}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-sm font-medium truncate">
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="attachments" className="mt-0 space-y-4">
                    <div className="space-y-4">
                      {/* File Upload Area */}
                      <div 
                        className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          onChange={handleFileSelect}
                          className="hidden"
                          accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx"
                        />
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <h3 className="text-sm font-semibold mb-1">Click to upload files</h3>
                        <p className="text-xs text-muted-foreground">
                          or drag and drop files here
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Supported: Images, PDF, DOC, TXT, XLS, PPT (Max 10MB per file)
                        </p>
                      </div>

                      {/* Attached Files List */}
                      {attachments.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Attached Files ({attachments.length})</h4>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {attachments.map((file, index) => (
                              <div key={index} className="flex items-center justify-between p-3 rounded-md border bg-muted/30 group hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="text-2xl shrink-0">{getFileIcon(file)}</span>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handlePreviewFile(file)}
                                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Preview file"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDownloadFile(file)}
                                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Download file"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeAttachment(index)}
                                    className="h-8 w-8 p-0"
                                    title="Remove file"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {attachments.length === 0 && (
                        <p className="text-xs text-center text-muted-foreground">
                          No files attached yet. Files will be uploaded when you create the task.
                        </p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="links" className="mt-0 space-y-4">
                    <FormField
                      control={form.control}
                      name="links"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-2 mb-2">
                            <Link className="h-4 w-4 text-muted-foreground" />
                            <FormLabel className="text-sm font-medium">Links</FormLabel>
                          </div>
                          <FormControl>
                            <LinkInput
                              value={field.value || []}
                              onChange={field.onChange}
                              maxLinks={10}
                              placeholder="Add a link (press Enter to add)"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 mt-auto">
                <DialogFooter className="flex-row justify-between sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="w-24"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    form="task-create-form"
                    className="w-32"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Task
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            </Tabs>
          </form>
        </Form>
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
"use client"

import * as React from "react"
import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import {
  FileText,
  Image,
  FileCode,
  FileSpreadsheet,
  File,
  Download,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
import { useToast } from "@/hooks/use-toast"

interface AttachmentListProps {
  taskId: Id<"tasks">
  className?: string
}

interface Attachment {
  storageId: string
  url: string | null
  fileName?: string
  fileSize?: number
  fileType?: string
}

// Helper to get file icon based on type
function getFileIcon(fileType?: string) {
  if (!fileType) return File

  if (fileType.startsWith("image/")) return Image
  if (fileType === "application/pdf") return FileText
  if (fileType.includes("spreadsheet") || fileType.includes("excel")) return FileSpreadsheet
  if (fileType.includes("word") || fileType === "text/plain") return FileText
  if (fileType.includes("zip") || fileType.includes("rar")) return FileCode
  
  return File
}

// Helper to format file size
function formatFileSize(bytes?: number): string {
  if (!bytes) return "Unknown size"
  
  const sizes = ["Bytes", "KB", "MB", "GB"]
  if (bytes === 0) return "0 Bytes"
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i]
}

// Helper to extract filename from URL or generate one
function getFileName(url: string, storageId: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split("/").pop()
    return filename || `attachment-${storageId.slice(0, 8)}`
  } catch {
    return `attachment-${storageId.slice(0, 8)}`
  }
}

export function AttachmentList({ taskId, className }: AttachmentListProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { toast } = useToast()

  const attachments = useQuery(api.attachments.getTaskAttachmentUrls, { taskId })
  const deleteAttachment = useMutation(api.attachments.deleteAttachment)

  const handleDownload = async (attachment: Attachment) => {
    if (!attachment.url) {
      toast({
        title: "Error",
        description: "Attachment URL not found",
        variant: "destructive",
      })
      return
    }

    try {
      // Open in new tab for download
      window.open(attachment.url, "_blank")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download attachment",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (storageId: string) => {
    setDeletingId(storageId)
    
    try {
      await deleteAttachment({ taskId, storageId })
      toast({
        title: "Success",
        description: "Attachment deleted successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete attachment",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
      setDeleteConfirmId(null)
    }
  }

  if (attachments === undefined) {
    return (
      <div className={cn("space-y-2", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <Skeleton className="h-5 w-5 rounded" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!attachments || attachments.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <File className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No attachments</p>
      </div>
    )
  }

  return (
    <>
      <div className={cn("space-y-2", className)}>
        {attachments.map((attachment) => {
          if (!attachment) return null

          const fileName = attachment.fileName || getFileName(attachment.url || "", attachment.storageId)
          const FileIcon = getFileIcon(attachment.fileType)
          const isDeleting = deletingId === attachment.storageId

          return (
            <div
              key={attachment.storageId}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border bg-card transition-opacity",
                isDeleting && "opacity-50"
              )}
            >
              <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.fileSize)}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {attachment.url ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDownload(attachment)}
                      disabled={isDeleting}
                    >
                      <Download className="h-4 w-4" />
                      <span className="sr-only">Download {fileName}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteConfirmId(attachment.storageId)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      <span className="sr-only">Delete {fileName}</span>
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs">Not found</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The attachment will be permanently
              deleted from the task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
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
"use client"

import * as React from "react"
import { useCallback, useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Upload, FileText, Loader2, X, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface AttachmentUploaderProps {
  taskId: Id<"tasks">
  onUploadComplete?: (storageIds: string[]) => void
  onError?: (error: string) => void
  className?: string
}

interface FileUpload {
  id: string
  file: File
  progress: number
  status: "pending" | "uploading" | "complete" | "error"
  error?: string
  storageId?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-rar-compressed",
]

export function AttachmentUploader({
  taskId,
  onUploadComplete,
  onError,
  className,
}: AttachmentUploaderProps) {
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl)

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
    }
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return "File type not allowed. Please upload images, PDFs, or documents."
    }
    return null
  }

  const uploadFile = async (fileUpload: FileUpload) => {
    const { id, file } = fileUpload

    // Update status to uploading
    setUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: "uploading" } : u))
    )

    try {
      // Generate upload URL
      const uploadUrl = await generateUploadUrl({
        taskId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      })

      // Upload the file
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })

      if (!response.ok) {
        throw new Error("Upload failed")
      }

      const { storageId } = await response.json()

      // Update status to complete
      setUploads((prev) =>
        prev.map((u) =>
          u.id === id
            ? { ...u, status: "complete", progress: 100, storageId }
            : u
        )
      )

      return storageId
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed"
      
      // Update status to error
      setUploads((prev) =>
        prev.map((u) =>
          u.id === id ? { ...u, status: "error", error: errorMessage } : u
        )
      )
      
      if (onError) {
        onError(errorMessage)
      }
      
      throw error
    }
  }

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return

      const newUploads: FileUpload[] = []

      // Validate and create upload objects
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const error = validateFile(file)

        if (error) {
          if (onError) {
            onError(`${file.name}: ${error}`)
          }
          continue
        }

        newUploads.push({
          id: `${Date.now()}-${i}`,
          file,
          progress: 0,
          status: "pending",
        })
      }

      if (newUploads.length === 0) return

      // Add to uploads state
      setUploads((prev) => [...prev, ...newUploads])

      // Upload files
      const uploadPromises = newUploads.map((upload) => uploadFile(upload))
      
      try {
        const storageIds = await Promise.all(uploadPromises)
        const validStorageIds = storageIds.filter((id) => id !== undefined) as string[]
        
        if (validStorageIds.length > 0 && onUploadComplete) {
          onUploadComplete(validStorageIds)
        }
      } catch (error) {
        // Errors are already handled in uploadFile
      }
    },
    [taskId, generateUploadUrl, onError, onUploadComplete]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files)
    },
    [handleFiles]
  )

  const removeUpload = useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id))
  }, [])

  const pendingUploads = uploads.filter((u) => u.status === "pending" || u.status === "uploading")
  const completedUploads = uploads.filter((u) => u.status === "complete")
  const errorUploads = uploads.filter((u) => u.status === "error")

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        )}
      >
        <input
          type="file"
          id="file-upload"
          className="sr-only"
          multiple
          accept={ALLOWED_FILE_TYPES.join(",")}
          onChange={handleFileSelect}
        />
        <label
          htmlFor="file-upload"
          className="flex flex-col items-center justify-center cursor-pointer"
        >
          <Upload className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">
            Drop files here or click to upload
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Images, PDFs, and documents up to 10MB
          </p>
        </label>
      </div>

      {/* Upload list */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{upload.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(upload.file.size / 1024).toFixed(1)} KB
                </p>
                {upload.status === "uploading" && (
                  <Progress value={upload.progress} className="mt-1 h-1" />
                )}
                {upload.status === "error" && (
                  <p className="text-xs text-destructive mt-1">{upload.error}</p>
                )}
              </div>
              <div className="shrink-0">
                {upload.status === "uploading" && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {upload.status === "complete" && (
                  <div className="h-4 w-4 rounded-full bg-green-500" />
                )}
                {upload.status === "error" && (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                {(upload.status === "pending" || upload.status === "error") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeUpload(upload.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error summary */}
      {errorUploads.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {errorUploads.length} file{errorUploads.length > 1 ? "s" : ""} failed
            to upload. Please try again.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
"use client"

import * as React from "react"
import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Paperclip, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AttachmentList } from "./attachment-list"
import { useToast } from "@/hooks/use-toast"

interface AttachmentsSectionProps {
  taskId: Id<"tasks">
  currentAttachments?: string[]
  onUpdate?: (attachments: string[]) => void
  className?: string
}

export function AttachmentsSection({
  taskId,
  currentAttachments = [],
  onUpdate,
  className,
}: AttachmentsSectionProps) {
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()
  const updateAttachments = useMutation(api.tasks.updateAttachments)
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    const newStorageIds: string[] = []

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "Error",
            description: `${file.name} exceeds 10MB limit`,
            variant: "destructive",
          })
          continue
        }

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
          throw new Error(`Failed to upload ${file.name}`)
        }

        const { storageId } = await response.json()
        newStorageIds.push(storageId)
      }

      if (newStorageIds.length > 0) {
        const updatedAttachments = [...currentAttachments, ...newStorageIds]
        
        // Update in database
        await updateAttachments({
          taskId,
          attachments: updatedAttachments,
        })

        // Call parent update handler
        if (onUpdate) {
          onUpdate(updatedAttachments)
        }

        toast({
          title: "Success",
          description: `${newStorageIds.length} file${newStorageIds.length > 1 ? 's' : ''} uploaded successfully`,
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleAddClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Attachments</h3>
          {currentAttachments.length > 0 && (
            <span className="text-sm text-muted-foreground">
              ({currentAttachments.length})
            </span>
          )}
        </div>
        
        {currentAttachments.length < 10 && (
          <Button
            onClick={handleAddClick}
            disabled={isUploading}
            size="sm"
            variant="outline"
            className="h-7 px-2"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Attachment list */}
      {currentAttachments.length > 0 ? (
        <AttachmentList taskId={taskId} />
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          No attachments yet
        </p>
      )}
      
      {currentAttachments.length >= 10 && (
        <p className="text-xs text-muted-foreground text-center">
          Maximum 10 attachments allowed
        </p>
      )}
    </div>
  )
}
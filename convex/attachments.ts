import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";

// Maximum file size in bytes (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Maximum number of attachments per task
const MAX_ATTACHMENTS_PER_TASK = 10;

// Allowed file types
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
];

// Helper to check workspace access through task
async function ensureTaskAccess(ctx: any, taskId: any) {
  const user = await getCurrentUserOrThrow(ctx);
  
  const task = await ctx.db.get(taskId);
  if (!task) {
    throw new Error("Task not found");
  }
  
  const member = await ctx.db
    .query("workspaceMembers")
    .withIndex("byWorkspaceAndUser", (q: any) =>
      q.eq("workspaceId", task.workspaceId).eq("userId", user._id)
    )
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();
    
  if (!member) {
    throw new Error("Access denied");
  }
  
  return { user, member, task };
}

// Generate a secure upload URL for file uploads
export const generateUploadUrl = mutation({
  args: {
    taskId: v.id("tasks"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const { task } = await ensureTaskAccess(ctx, args.taskId);
    
    // Validate file size
    if (args.fileSize > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }
    
    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(args.fileType)) {
      throw new Error("File type not allowed");
    }
    
    // Check current attachment count
    const currentAttachments = task.attachments || [];
    if (currentAttachments.length >= MAX_ATTACHMENTS_PER_TASK) {
      throw new Error(`Maximum number of attachments (${MAX_ATTACHMENTS_PER_TASK}) reached`);
    }
    
    // Generate upload URL from Convex storage
    const uploadUrl = await ctx.storage.generateUploadUrl();
    
    return uploadUrl;
  },
});

// Delete an attachment from storage and update task
export const deleteAttachment = mutation({
  args: {
    taskId: v.id("tasks"),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const { task } = await ensureTaskAccess(ctx, args.taskId);
    
    // Remove from task attachments array
    const updatedAttachments = (task.attachments || []).filter(
      (attachmentId: string) => attachmentId !== args.storageId
    );
    
    // Update task
    await ctx.db.patch(args.taskId, {
      attachments: updatedAttachments,
      updatedAt: new Date().toISOString(),
    });
    
    // Delete from storage
    try {
      await ctx.storage.delete(args.storageId);
    } catch (error) {
      // Storage might already be deleted, continue
      console.warn("Failed to delete attachment from storage:", error);
    }
  },
});

// Get serving URL for a stored attachment
export const getAttachmentUrl = query({
  args: {
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the serving URL from Convex storage
    const url = await ctx.storage.getUrl(args.storageId);
    
    if (!url) {
      throw new Error("Attachment not found");
    }
    
    return url;
  },
});

// Get all attachment URLs for a task
export const getTaskAttachmentUrls = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    await ensureTaskAccess(ctx, args.taskId);
    
    const task = await ctx.db.get(args.taskId);
    if (!task || !task.attachments) {
      return [];
    }
    
    // Get URLs for all attachments
    const attachmentUrls = await Promise.all(
      task.attachments.map(async (storageId: string) => {
        try {
          const url = await ctx.storage.getUrl(storageId);
          return {
            storageId,
            url,
          };
        } catch (error) {
          // Attachment might have been deleted
          console.warn(`Failed to get URL for attachment ${storageId}:`, error);
          return null;
        }
      })
    );
    
    // Filter out null values
    return attachmentUrls.filter((attachment) => attachment !== null);
  },
});

// Clean up attachments when a task is deleted
export const cleanupTaskAttachments = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const { task } = await ensureTaskAccess(ctx, args.taskId);
    
    if (!task.attachments || task.attachments.length === 0) {
      return;
    }
    
    // Delete all attachments from storage
    await Promise.all(
      task.attachments.map(async (storageId: string) => {
        try {
          await ctx.storage.delete(storageId);
        } catch (error) {
          // Storage might already be deleted, continue
          console.warn(`Failed to delete attachment ${storageId}:`, error);
        }
      })
    );
  },
});
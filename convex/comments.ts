import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getCurrentUserOrThrow } from "./users";

// Permissions helper - reusing the pattern from tasks.ts
async function ensureWorkspaceAccess(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  permission: string
) {
  const user = await getCurrentUserOrThrow(ctx);
  
  const member = await ctx.db
    .query("workspaceMembers")
    .withIndex("byWorkspaceAndUser", (q: any) =>
      q.eq("workspaceId", workspaceId).eq("userId", user._id)
    )
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();

  if (!member) {
    throw new Error("Access denied");
  }

  return { user, member };
}

// Create a new comment
export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    workspaceId: v.id("workspaces"),
    content: v.string(),
    mentions: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    // Validate user has access to the workspace
    const { user } = await ensureWorkspaceAccess(
      ctx,
      args.workspaceId,
      "comments.create"
    );

    // Verify the task exists and belongs to the workspace
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    if (task.workspaceId !== args.workspaceId) {
      throw new Error("Task does not belong to this workspace");
    }

    // Create the comment
    const commentId = await ctx.db.insert("comments", {
      taskId: args.taskId,
      workspaceId: args.workspaceId,
      userId: user._id,
      content: args.content.trim(),
      mentions: args.mentions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEdited: false,
      isDeleted: false,
    });

    return commentId;
  },
});

// Get all comments for a specific task
export const list = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    // Get the task to verify workspace access
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    // Validate user has access to the workspace
    await ensureWorkspaceAccess(ctx, task.workspaceId, "comments.view");

    // Get all non-deleted comments for the task
    const comments = await ctx.db
      .query("comments")
      .withIndex("byTaskAndDeleted", (q) =>
        q.eq("taskId", args.taskId).eq("isDeleted", false)
      )
      .collect();

    // Sort by createdAt descending (newest first)
    comments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Enrich comments with user data
    const enrichedComments = await Promise.all(
      comments.map(async (comment) => {
        const [user, mentionedUsers] = await Promise.all([
          ctx.db.get(comment.userId),
          comment.mentions
            ? Promise.all(comment.mentions.map(id => ctx.db.get(id)))
            : [],
        ]);

        return {
          ...comment,
          user,
          mentionedUsers: mentionedUsers.filter(Boolean),
        };
      })
    );

    return enrichedComments;
  },
});

// Update an existing comment
export const update = mutation({
  args: {
    commentId: v.id("comments"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the comment
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }
    if (comment.isDeleted) {
      throw new Error("Cannot edit deleted comment");
    }

    // Get current user
    const { user } = await ensureWorkspaceAccess(
      ctx,
      comment.workspaceId,
      "comments.update"
    );

    // Only the comment author can edit
    if (comment.userId !== user._id) {
      throw new Error("Only the comment author can edit this comment");
    }

    // Prevent editing very old comments (e.g., older than 24 hours)
    const commentAge = Date.now() - new Date(comment.createdAt).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (commentAge > twentyFourHours) {
      throw new Error("Comments can only be edited within 24 hours of creation");
    }

    // Update the comment
    await ctx.db.patch(args.commentId, {
      content: args.content.trim(),
      isEdited: true,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Soft delete a comment
export const deleteComment = mutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    // Get the comment
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }
    if (comment.isDeleted) {
      throw new Error("Comment already deleted");
    }

    // Get current user and member info
    const { user, member } = await ensureWorkspaceAccess(
      ctx,
      comment.workspaceId,
      "comments.delete"
    );

    // Only comment author or workspace admin/owner can delete
    const canDelete = 
      comment.userId === user._id || 
      member.role === "owner" || 
      member.role === "admin";

    if (!canDelete) {
      throw new Error("You don't have permission to delete this comment");
    }

    // Soft delete the comment
    await ctx.db.patch(args.commentId, {
      isDeleted: true,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Get comment count for multiple tasks (useful for bulk operations)
export const getCommentCounts = query({
  args: {
    taskIds: v.array(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    if (args.taskIds.length === 0) {
      return {};
    }

    // Get the first task to check workspace access
    const firstTask = await ctx.db.get(args.taskIds[0]);
    if (!firstTask) {
      return {};
    }

    // Validate user has access to the workspace
    await ensureWorkspaceAccess(ctx, firstTask.workspaceId, "comments.view");

    // Get comment counts for each task
    const counts: Record<string, number> = {};
    
    await Promise.all(
      args.taskIds.map(async (taskId) => {
        const comments = await ctx.db
          .query("comments")
          .withIndex("byTaskAndDeleted", (q) =>
            q.eq("taskId", taskId).eq("isDeleted", false)
          )
          .collect();
        
        counts[taskId] = comments.length;
      })
    );

    return counts;
  },
});

// Get recent comments for a workspace (for activity feed)
export const getRecentComments = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Validate user has access to the workspace
    await ensureWorkspaceAccess(ctx, args.workspaceId, "comments.view");

    const limit = args.limit || 10;

    // Get recent non-deleted comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();

    // Sort by createdAt descending
    comments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Take only the requested limit
    const recentComments = comments.slice(0, limit);

    // Enrich with user and task data
    const enrichedComments = await Promise.all(
      recentComments.map(async (comment) => {
        const [user, task] = await Promise.all([
          ctx.db.get(comment.userId),
          ctx.db.get(comment.taskId),
        ]);

        return {
          ...comment,
          user,
          task,
        };
      })
    );

    return enrichedComments;
  },
});
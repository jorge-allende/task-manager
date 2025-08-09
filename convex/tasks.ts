import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getCurrentUserOrThrow } from "./users";
import { paginationOptsValidator } from "convex/server";

// Helper function for generating fractional indices
// This allows us to insert tasks between existing tasks without reordering everything
function generateFractionalIndex(before: number | null, after: number | null): number {
  if (before === null && after === null) {
    return 0.5;
  }
  if (before === null && after !== null) {
    return after / 2;
  }
  if (before !== null && after === null) {
    return before + 0.5;
  }
  return (before! + after!) / 2;
}

// Permissions helper
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

  // For now, all members can perform all actions
  // Later we can add more granular permissions based on role
  return { user, member };
}

// Create a new task
export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done")
    ),
    columnId: v.optional(v.id("columns")), // Support both status and columnId during migration
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    assignedTo: v.optional(v.array(v.id("users"))),
    dueDate: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    attachments: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { user } = await ensureWorkspaceAccess(
      ctx,
      args.workspaceId,
      "tasks.create"
    );

    // If columnId is provided, use it; otherwise map status to column
    let columnId = args.columnId;
    if (!columnId && args.status) {
      // Try to find column by matching status name
      const columns = await ctx.db
        .query("columns")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();
      
      // Map old status to column names
      const statusToColumnName: Record<string, string> = {
        todo: "To Do",
        in_progress: "In Progress",
        review: "Review",
        done: "Done",
      };
      
      const targetColumnName = statusToColumnName[args.status];
      const column = columns.find(c => c.name === targetColumnName);
      
      if (column) {
        columnId = column._id;
      }
    }

    // Find the highest position in the target status/column
    let maxPosition = -1;
    
    if (columnId) {
      // Query by column
      const tasksInColumn = await ctx.db
        .query("tasks")
        .withIndex("byWorkspaceAndColumn", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("columnId", columnId)
        )
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
      
      if (tasksInColumn.length > 0) {
        maxPosition = Math.max(...tasksInColumn.map(t => t.position));
      }
    } else {
      // Query by status (fallback)
      const tasksInStatus = await ctx.db
        .query("tasks")
        .withIndex("byWorkspaceAndStatus", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status)
        )
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
      
      if (tasksInStatus.length > 0) {
        maxPosition = Math.max(...tasksInStatus.map(t => t.position));
      }
    }

    const taskId = await ctx.db.insert("tasks", {
      ...args,
      columnId,
      createdBy: user._id,
      position: maxPosition + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
    });

    return taskId;
  },
});

// Get tasks for a workspace with pagination and filters
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done")
    )),
    priority: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    )),
    assignedToMe: v.optional(v.boolean()),
    createdByMe: v.optional(v.boolean()),
    search: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    includeArchived: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { user } = await ensureWorkspaceAccess(
      ctx,
      args.workspaceId,
      "tasks.view"
    );

    let query = ctx.db
      .query("tasks")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId));

    // Apply filters
    if (!args.includeArchived) {
      query = query.filter((q) => q.eq(q.field("isArchived"), false));
    }

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }

    if (args.priority) {
      query = query.filter((q) => q.eq(q.field("priority"), args.priority));
    }

    // Note: assignedToMe filter will be applied after collecting results

    if (args.createdByMe) {
      query = query.filter((q) => q.eq(q.field("createdBy"), user._id));
    }

    // Note: search filter will be applied after collecting results

    // Note: tags filter will be applied after collecting results

    // Collect all results and apply filters in JavaScript
    const allResults = await query.collect();
    
    // Apply filters
    let filteredResults = allResults;
    
    // Filter by assignedToMe
    if (args.assignedToMe) {
      filteredResults = filteredResults.filter(task => 
        task.assignedTo && task.assignedTo.includes(user._id)
      );
    }
    
    // Filter by search
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      filteredResults = filteredResults.filter(task => 
        task.title.toLowerCase().includes(searchLower) ||
        (task.description && task.description.toLowerCase().includes(searchLower))
      );
    }
    
    // Filter by tags
    if (args.tags && args.tags.length > 0) {
      filteredResults = filteredResults.filter(task => {
        const taskTags = task.tags || [];
        return args.tags!.some(tag => taskTags.includes(tag));
      });
    }
    
    // Sort by position
    filteredResults.sort((a, b) => a.position - b.position);
    
    // Manual pagination
    // Parse cursor as number if it exists, otherwise start at 0
    const start = args.paginationOpts.cursor ? parseInt(args.paginationOpts.cursor, 10) : 0;
    const pageSize = args.paginationOpts.numItems;
    const paginatedResults = filteredResults.slice(start, start + pageSize);
    const hasMore = filteredResults.length > start + pageSize;
    
    // Enrich with user data
    const enrichedTasks = await Promise.all(
      paginatedResults.map(async (task) => {
        const [creator, assignees, commentCount] = await Promise.all([
          ctx.db.get(task.createdBy),
          task.assignedTo 
            ? Promise.all(task.assignedTo.map(id => ctx.db.get(id)))
            : [],
          ctx.db
            .query("comments")
            .withIndex("byTaskAndDeleted", (q) => 
              q.eq("taskId", task._id).eq("isDeleted", false)
            )
            .collect()
            .then(comments => comments.length),
        ]);

        return {
          ...task,
          creator,
          assignees: assignees.filter(Boolean),
          commentCount,
        };
      })
    );

    return {
      page: enrichedTasks,
      continueCursor: hasMore ? String(start + pageSize) : null,
      isDone: !hasMore,
    };
  },
});

// Get tasks grouped by columns for the Kanban board
export const listForBoard = query({
  args: {
    workspaceId: v.id("workspaces"),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ensureWorkspaceAccess(ctx, args.workspaceId, "tasks.view");

    // Get all columns for the workspace
    const columns = await ctx.db
      .query("columns")
      .withIndex("byWorkspace", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .collect();

    // Sort columns by position
    columns.sort((a, b) => a.position - b.position);

    // Get all tasks
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("byWorkspaceAndArchived", (q: any) => 
        q.eq("workspaceId", args.workspaceId)
         .eq("isArchived", args.includeArchived || false)
      )
      .collect();

    // Group tasks by column
    const tasksByColumn: Record<string, typeof tasks> = {};
    
    // Initialize empty arrays for each column
    columns.forEach(column => {
      tasksByColumn[column._id] = [];
    });

    // Group tasks
    tasks.forEach(task => {
      if (task.columnId && tasksByColumn[task.columnId]) {
        tasksByColumn[task.columnId].push(task);
      } else {
        // Fallback: use status to find appropriate column
        const statusToColumnName: Record<string, string> = {
          todo: "To Do",
          in_progress: "In Progress",
          review: "Review",
          done: "Done",
        };
        
        const targetColumnName = statusToColumnName[task.status];
        const column = columns.find(c => c.name === targetColumnName);
        
        if (column && tasksByColumn[column._id]) {
          tasksByColumn[column._id].push(task);
        }
      }
    });

    // Sort tasks within each column by position
    Object.keys(tasksByColumn).forEach(columnId => {
      tasksByColumn[columnId].sort((a, b) => a.position - b.position);
    });

    // Enrich tasks with user data
    const enrichedTasksByColumn: Record<string, any[]> = {};

    await Promise.all(
      Object.entries(tasksByColumn).map(async ([columnId, columnTasks]) => {
        enrichedTasksByColumn[columnId] = await Promise.all(
          columnTasks.map(async (task) => {
            const [creator, assignees, commentCount] = await Promise.all([
              ctx.db.get(task.createdBy),
              task.assignedTo 
                ? Promise.all(task.assignedTo.map(id => ctx.db.get(id)))
                : [],
              ctx.db
                .query("comments")
                .withIndex("byTaskAndDeleted", (q) => 
                  q.eq("taskId", task._id).eq("isDeleted", false)
                )
                .collect()
                .then(comments => comments.length),
            ]);

            return {
              ...task,
              creator,
              assignees: assignees.filter(Boolean),
              commentCount,
            };
          })
        );
      })
    );

    // Return both columns and tasks
    return {
      columns,
      tasksByColumn: enrichedTasksByColumn,
    };
  },
});

// Legacy version for backward compatibility
export const listForBoardLegacy = query({
  args: {
    workspaceId: v.id("workspaces"),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ensureWorkspaceAccess(ctx, args.workspaceId, "tasks.view");

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("byWorkspaceAndArchived", (q: any) => 
        q.eq("workspaceId", args.workspaceId)
         .eq("isArchived", args.includeArchived || false)
      )
      .collect();

    // Group by status and sort by position
    const tasksByStatus = {
      todo: [] as typeof tasks,
      in_progress: [] as typeof tasks,
      review: [] as typeof tasks,
      done: [] as typeof tasks,
    };

    tasks.forEach(task => {
      tasksByStatus[task.status].push(task);
    });

    // Sort each status column by position
    Object.keys(tasksByStatus).forEach(status => {
      tasksByStatus[status as keyof typeof tasksByStatus].sort(
        (a, b) => a.position - b.position
      );
    });

    // Enrich with user data
    const enrichedTasksByStatus: typeof tasksByStatus = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };

    await Promise.all(
      Object.entries(tasksByStatus).map(async ([status, statusTasks]) => {
        enrichedTasksByStatus[status as keyof typeof tasksByStatus] = await Promise.all(
          statusTasks.map(async (task) => {
            const [creator, assignees] = await Promise.all([
              ctx.db.get(task.createdBy),
              task.assignedTo 
                ? Promise.all(task.assignedTo.map(id => ctx.db.get(id)))
                : [],
            ]);

            return {
              ...task,
              creator,
              assignees: assignees.filter(Boolean),
            };
          })
        );
      })
    );

    return enrichedTasksByStatus;
  },
});

// Get a single task
export const get = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new Error("Task not found");
    }

    await ensureWorkspaceAccess(ctx, task.workspaceId, "tasks.view");

    const [creator, assignees, comments] = await Promise.all([
      ctx.db.get(task.createdBy),
      task.assignedTo 
        ? Promise.all(task.assignedTo.map(id => ctx.db.get(id)))
        : [],
      ctx.db
        .query("comments")
        .withIndex("byTaskAndDeleted", (q) => 
          q.eq("taskId", task._id).eq("isDeleted", false)
        )
        .collect(),
    ]);

    // Enrich comments with user data
    const enrichedComments = await Promise.all(
      comments.map(async (comment) => {
        const user = await ctx.db.get(comment.userId);
        return {
          ...comment,
          user,
        };
      })
    );

    return {
      ...task,
      creator,
      assignees: assignees.filter(Boolean),
      comments: enrichedComments,
    };
  },
});

// Update a task
export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done")
    )),
    columnId: v.optional(v.id("columns")),
    priority: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    )),
    assignedTo: v.optional(v.array(v.id("users"))),
    dueDate: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    attachments: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new Error("Task not found");
    }

    await ensureWorkspaceAccess(ctx, task.workspaceId, "tasks.update");

    const updates: Partial<Doc<"tasks">> = {
      updatedAt: new Date().toISOString(),
    };

    // Copy over provided fields
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.assignedTo !== undefined) updates.assignedTo = args.assignedTo;
    if (args.dueDate !== undefined) updates.dueDate = args.dueDate;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.attachments !== undefined) updates.attachments = args.attachments;

    // Handle status and columnId updates
    if (args.columnId !== undefined) {
      updates.columnId = args.columnId;
      
      // Update status based on column name for backward compatibility
      const column = await ctx.db.get(args.columnId);
      if (column) {
        const columnNameToStatus: Record<string, typeof task.status> = {
          "To Do": "todo",
          "In Progress": "in_progress",
          "Review": "review",
          "Done": "done",
        };
        
        const mappedStatus = columnNameToStatus[column.name];
        if (mappedStatus) {
          updates.status = mappedStatus;
        }
      }
    } else if (args.status !== undefined) {
      updates.status = args.status;
      
      // Try to find matching column
      const columns = await ctx.db
        .query("columns")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", task.workspaceId))
        .collect();
      
      const statusToColumnName: Record<string, string> = {
        todo: "To Do",
        in_progress: "In Progress",
        review: "Review",
        done: "Done",
      };
      
      const targetColumnName = statusToColumnName[args.status];
      const column = columns.find(c => c.name === targetColumnName);
      
      if (column) {
        updates.columnId = column._id;
      }
    }

    // Handle completed timestamp
    if (updates.status === "done" && task.status !== "done") {
      updates.completedAt = new Date().toISOString();
    } else if (updates.status !== "done" && task.status === "done") {
      updates.completedAt = undefined;
    }

    await ctx.db.patch(args.id, updates);
  },
});

// Delete (archive) a task
export const archive = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new Error("Task not found");
    }

    await ensureWorkspaceAccess(ctx, task.workspaceId, "tasks.delete");

    await ctx.db.patch(args.id, {
      isArchived: true,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Restore an archived task
export const restore = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new Error("Task not found");
    }

    await ensureWorkspaceAccess(ctx, task.workspaceId, "tasks.update");

    await ctx.db.patch(args.id, {
      isArchived: false,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Permanently delete a task
export const permanentDelete = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new Error("Task not found");
    }

    const { member } = await ensureWorkspaceAccess(
      ctx,
      task.workspaceId,
      "tasks.delete"
    );

    // Only owners and admins can permanently delete
    if (member.role !== "owner" && member.role !== "admin") {
      throw new Error("Only workspace owners and admins can permanently delete tasks");
    }

    // Delete associated comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("byTask", (q) => q.eq("taskId", args.id))
      .collect();

    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Delete the task
    await ctx.db.delete(args.id);
  },
});

// Reorder task within or between columns
export const reorder = mutation({
  args: {
    taskId: v.id("tasks"),
    newStatus: v.optional(v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done")
    )),
    newColumnId: v.optional(v.id("columns")),
    beforeTaskId: v.optional(v.id("tasks")),
    afterTaskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    await ensureWorkspaceAccess(ctx, task.workspaceId, "tasks.update");

    // Determine target column
    let targetColumnId = args.newColumnId || task.columnId;
    let targetStatus = args.newStatus || task.status;
    
    if (args.newColumnId && !args.newStatus) {
      // If only columnId provided, update status based on column
      const column = await ctx.db.get(args.newColumnId);
      if (column) {
        const columnNameToStatus: Record<string, typeof task.status> = {
          "To Do": "todo",
          "In Progress": "in_progress",
          "Review": "review",
          "Done": "done",
        };
        
        const mappedStatus = columnNameToStatus[column.name];
        if (mappedStatus) {
          targetStatus = mappedStatus;
        }
      }
    } else if (args.newStatus && !args.newColumnId) {
      // If only status provided, find matching column
      const columns = await ctx.db
        .query("columns")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", task.workspaceId))
        .collect();
      
      const statusToColumnName: Record<string, string> = {
        todo: "To Do",
        in_progress: "In Progress",
        review: "Review",
        done: "Done",
      };
      
      const targetColumnName = statusToColumnName[args.newStatus];
      const column = columns.find(c => c.name === targetColumnName);
      
      if (column) {
        targetColumnId = column._id;
      }
    }

    // Calculate new position
    let beforePosition: number | null = null;
    let afterPosition: number | null = null;

    if (args.beforeTaskId) {
      const beforeTask = await ctx.db.get(args.beforeTaskId);
      if (beforeTask && beforeTask.workspaceId === task.workspaceId) {
        beforePosition = beforeTask.position;
      }
    }

    if (args.afterTaskId) {
      const afterTask = await ctx.db.get(args.afterTaskId);
      if (afterTask && afterTask.workspaceId === task.workspaceId) {
        afterPosition = afterTask.position;
      }
    }

    // Calculate new position using fractional indexing
    const newPosition = generateFractionalIndex(beforePosition, afterPosition);

    const updates: Partial<Doc<"tasks">> = {
      position: newPosition,
      updatedAt: new Date().toISOString(),
    };

    // Update column/status if changed
    if (targetColumnId !== task.columnId) {
      updates.columnId = targetColumnId;
    }
    if (targetStatus !== task.status) {
      updates.status = targetStatus;
      
      // Handle completed timestamp
      if (targetStatus === "done" && task.status !== "done") {
        updates.completedAt = new Date().toISOString();
      } else if (targetStatus !== "done" && task.status === "done") {
        updates.completedAt = undefined;
      }
    }

    await ctx.db.patch(args.taskId, updates);
  },
});

// Bulk update tasks
export const bulkUpdate = mutation({
  args: {
    taskIds: v.array(v.id("tasks")),
    updates: v.object({
      status: v.optional(v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("review"),
        v.literal("done")
      )),
      columnId: v.optional(v.id("columns")),
      priority: v.optional(v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent")
      )),
      assignedTo: v.optional(v.array(v.id("users"))),
      tags: v.optional(v.array(v.string())),
      isArchived: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    if (args.taskIds.length === 0) {
      return;
    }

    // Verify all tasks belong to the same workspace
    const tasks = await Promise.all(args.taskIds.map(id => ctx.db.get(id)));
    const workspaceId = tasks[0]?.workspaceId;
    
    if (!workspaceId || !tasks.every(t => t?.workspaceId === workspaceId)) {
      throw new Error("All tasks must belong to the same workspace");
    }

    await ensureWorkspaceAccess(ctx, workspaceId, "tasks.update");

    // Handle column/status updates
    let finalUpdates = { ...args.updates };
    
    if (args.updates.columnId && !args.updates.status) {
      // If only columnId provided, update status based on column
      const column = await ctx.db.get(args.updates.columnId);
      if (column) {
        const columnNameToStatus: Record<string, "todo" | "in_progress" | "review" | "done"> = {
          "To Do": "todo",
          "In Progress": "in_progress",
          "Review": "review",
          "Done": "done",
        };
        
        const mappedStatus = columnNameToStatus[column.name];
        if (mappedStatus) {
          finalUpdates.status = mappedStatus;
        }
      }
    } else if (args.updates.status && !args.updates.columnId) {
      // If only status provided, find matching column
      const columns = await ctx.db
        .query("columns")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspaceId))
        .collect();
      
      const statusToColumnName: Record<string, string> = {
        todo: "To Do",
        in_progress: "In Progress",
        review: "Review",
        done: "Done",
      };
      
      const targetColumnName = statusToColumnName[args.updates.status];
      const column = columns.find(c => c.name === targetColumnName);
      
      if (column) {
        finalUpdates.columnId = column._id;
      }
    }

    // Update each task
    for (const task of tasks) {
      if (!task) continue;

      const taskUpdates: Partial<Doc<"tasks">> = {
        ...finalUpdates,
        updatedAt: new Date().toISOString(),
      };

      // Handle completed timestamp
      if (finalUpdates.status) {
        if (finalUpdates.status === "done" && task.status !== "done") {
          taskUpdates.completedAt = new Date().toISOString();
        } else if (finalUpdates.status !== "done" && task.status === "done") {
          taskUpdates.completedAt = undefined;
        }
      }

      await ctx.db.patch(task._id, taskUpdates);
    }
  },
});

// Get all unique tags for a workspace
export const getTags = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await ensureWorkspaceAccess(ctx, args.workspaceId, "tasks.view");

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const tagSet = new Set<string>();
    tasks.forEach(task => {
      task.tags?.forEach(tag => tagSet.add(tag));
    });

    return Array.from(tagSet).sort();
  },
});

// Update task position when moving within the same column
export const updatePosition = mutation({
  args: {
    taskId: v.id("tasks"),
    beforeTaskId: v.optional(v.id("tasks")),
    afterTaskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    await ensureWorkspaceAccess(ctx, task.workspaceId, "tasks.update");

    let beforePosition: number | null = null;
    let afterPosition: number | null = null;

    if (args.beforeTaskId) {
      const beforeTask = await ctx.db.get(args.beforeTaskId);
      if (beforeTask && beforeTask.workspaceId === task.workspaceId) {
        beforePosition = beforeTask.position;
      }
    }

    if (args.afterTaskId) {
      const afterTask = await ctx.db.get(args.afterTaskId);
      if (afterTask && afterTask.workspaceId === task.workspaceId) {
        afterPosition = afterTask.position;
      }
    }

    const newPosition = generateFractionalIndex(beforePosition, afterPosition);

    await ctx.db.patch(args.taskId, {
      position: newPosition,
      updatedAt: new Date().toISOString(),
    });
  },
});
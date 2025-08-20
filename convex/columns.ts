import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Doc, Id } from "./_generated/dataModel"
import { getCurrentUserOrThrow } from "./users"

// Default columns for new workspaces
const DEFAULT_COLUMNS = [
  { name: "To Do", color: "bg-gray-500", position: 0 },
  { name: "In Progress", color: "bg-blue-500", position: 1 },
  { name: "Done", color: "bg-green-500", position: 2 },
]

// List all columns for a workspace
export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    // Verify user has access to workspace
    const user = await getCurrentUserOrThrow(ctx)

    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first()

    if (!member) {
      throw new Error("Access denied")
    }

    // Get columns sorted by position
    const columns = await ctx.db
      .query("columns")
      .withIndex("byWorkspace", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .collect()

    return columns.sort((a, b) => a.position - b.position)
  },
})

// Create a new column
export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user has admin/owner access
    const user = await getCurrentUserOrThrow(ctx)

    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first()

    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      throw new Error("Only workspace owners and admins can create columns")
    }

    // Check column limit (max 4)
    const existingColumns = await ctx.db
      .query("columns")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect()

    if (existingColumns.length >= 4) {
      throw new Error("Maximum 4 columns allowed per workspace")
    }

    // Calculate position for new column
    const maxPosition = Math.max(...existingColumns.map((c) => c.position), -1)

    // Create the column
    const columnId = await ctx.db.insert("columns", {
      workspaceId: args.workspaceId,
      name: args.name,
      color: args.color,
      position: maxPosition + 1,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    return columnId
  },
})

// Update a column (rename or change color)
export const update = mutation({
  args: {
    columnId: v.id("columns"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const column = await ctx.db.get(args.columnId)
    if (!column) {
      throw new Error("Column not found")
    }

    // Verify user has admin/owner access
    const user = await getCurrentUserOrThrow(ctx)

    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", column.workspaceId).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first()

    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      throw new Error("Only workspace owners and admins can update columns")
    }

    // Update the column
    const updates: Partial<Doc<"columns">> = {
      updatedAt: new Date().toISOString(),
    }

    if (args.name !== undefined) {
      updates.name = args.name
    }
    if (args.color !== undefined) {
      updates.color = args.color
    }

    await ctx.db.patch(args.columnId, updates)
  },
})

// Delete a column (with task reassignment)
export const remove = mutation({
  args: {
    columnId: v.id("columns"),
    reassignToColumnId: v.optional(v.id("columns")),
  },
  handler: async (ctx, args) => {
    const column = await ctx.db.get(args.columnId)
    if (!column) {
      throw new Error("Column not found")
    }

    // Verify user has admin/owner access
    const user = await getCurrentUserOrThrow(ctx)

    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", column.workspaceId).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first()

    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      throw new Error("Only workspace owners and admins can delete columns")
    }

    // Check minimum column limit (min 2)
    const existingColumns = await ctx.db
      .query("columns")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", column.workspaceId))
      .collect()

    if (existingColumns.length <= 2) {
      throw new Error("Minimum 2 columns required per workspace")
    }

    // Check if column has tasks
    const tasksInColumn = await ctx.db
      .query("tasks")
      .withIndex("byWorkspaceAndColumn", (q) =>
        q.eq("workspaceId", column.workspaceId).eq("columnId", args.columnId)
      )
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect()

    if (tasksInColumn.length > 0) {
      if (!args.reassignToColumnId) {
        throw new Error("Column has tasks. Please specify a column to reassign them to.")
      }

      // Verify reassign target exists and is different
      const targetColumn = await ctx.db.get(args.reassignToColumnId)
      if (!targetColumn || targetColumn.workspaceId !== column.workspaceId) {
        throw new Error("Invalid target column for reassignment")
      }

      if (args.reassignToColumnId === args.columnId) {
        throw new Error("Cannot reassign tasks to the same column")
      }

      // Reassign all tasks to the target column
      for (const task of tasksInColumn) {
        await ctx.db.patch(task._id, {
          columnId: args.reassignToColumnId,
          updatedAt: new Date().toISOString(),
        })
      }
    }

    // Delete the column
    await ctx.db.delete(args.columnId)

    // Reorder remaining columns to fill the gap
    const remainingColumns = existingColumns
      .filter((c) => c._id !== args.columnId)
      .sort((a, b) => a.position - b.position)

    for (let i = 0; i < remainingColumns.length; i++) {
      if (remainingColumns[i].position !== i) {
        await ctx.db.patch(remainingColumns[i]._id, { position: i })
      }
    }
  },
})

// Reorder columns
export const reorder = mutation({
  args: {
    columnId: v.id("columns"),
    newPosition: v.number(),
  },
  handler: async (ctx, args) => {
    const column = await ctx.db.get(args.columnId)
    if (!column) {
      throw new Error("Column not found")
    }

    // Verify user has admin/owner access
    const user = await getCurrentUserOrThrow(ctx)

    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", column.workspaceId).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first()

    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      throw new Error("Only workspace owners and admins can reorder columns")
    }

    // Get all columns for the workspace
    const columns = await ctx.db
      .query("columns")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", column.workspaceId))
      .collect()

    const sortedColumns = columns.sort((a, b) => a.position - b.position)
    const oldPosition = column.position
    const targetPosition = Math.max(0, Math.min(args.newPosition, columns.length - 1))

    if (oldPosition === targetPosition) {
      return // No change needed
    }

    // Update positions
    if (oldPosition < targetPosition) {
      // Moving right
      for (const col of sortedColumns) {
        if (col.position > oldPosition && col.position <= targetPosition) {
          await ctx.db.patch(col._id, { position: col.position - 1 })
        }
      }
    } else {
      // Moving left
      for (const col of sortedColumns) {
        if (col.position >= targetPosition && col.position < oldPosition) {
          await ctx.db.patch(col._id, { position: col.position + 1 })
        }
      }
    }

    // Update the moved column
    await ctx.db.patch(args.columnId, {
      position: targetPosition,
      updatedAt: new Date().toISOString(),
    })
  },
})

// Initialize default columns for a workspace
export const initializeDefaults = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    // Check if columns already exist
    const existingColumns = await ctx.db
      .query("columns")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first()

    if (existingColumns) {
      return // Columns already initialized
    }

    // Create default columns
    for (const defaultColumn of DEFAULT_COLUMNS) {
      await ctx.db.insert("columns", {
        workspaceId: args.workspaceId,
        name: defaultColumn.name,
        color: defaultColumn.color,
        position: defaultColumn.position,
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
  },
})

// Get columns with task counts
export const listWithCounts = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    // Verify user has access to workspace
    const user = await getCurrentUserOrThrow(ctx)

    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first()

    if (!member) {
      throw new Error("Access denied")
    }

    // Get columns sorted by position
    const columns = await ctx.db
      .query("columns")
      .withIndex("byWorkspace", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .collect()

    const sortedColumns = columns.sort((a, b) => a.position - b.position)

    // Get task counts for each column
    const columnsWithCounts = await Promise.all(
      sortedColumns.map(async (column: Doc<"columns">) => {
        const taskCount = await ctx.db
          .query("tasks")
          .withIndex("byWorkspaceAndColumn", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("columnId", column._id)
          )
          .filter((q) => q.eq(q.field("isArchived"), false))
          .collect()
          .then((tasks) => tasks.length)

        return {
          ...column,
          taskCount,
        }
      })
    )

    return columnsWithCounts
  },
})
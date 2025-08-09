import { v } from "convex/values"
import { internalMutation } from "./_generated/server"
import { Doc, Id } from "./_generated/dataModel"

// Status to column mapping
const STATUS_TO_COLUMN = {
  todo: { name: "To Do", color: "bg-gray-500", position: 0 },
  in_progress: { name: "In Progress", color: "bg-blue-500", position: 1 },
  review: { name: "Review", color: "bg-yellow-500", position: 2 },
  done: { name: "Done", color: "bg-green-500", position: 3 },
}

// Migrate existing workspaces to use dynamic columns
export const migrateWorkspacesToColumns = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("Starting workspace column migration...")
    
    // Get all workspaces
    const workspaces = await ctx.db.query("workspaces").collect()
    
    for (const workspace of workspaces) {
      // Check if workspace already has columns
      const existingColumns = await ctx.db
        .query("columns")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspace._id))
        .collect()
      
      if (existingColumns.length > 0) {
        console.log(`Workspace ${workspace._id} already has columns, skipping...`)
        continue
      }
      
      console.log(`Creating columns for workspace ${workspace._id}...`)
      
      // Create columns based on existing status values
      const columnMap: Record<string, Id<"columns">> = {}
      
      for (const [status, config] of Object.entries(STATUS_TO_COLUMN)) {
        const columnId = await ctx.db.insert("columns", {
          workspaceId: workspace._id,
          name: config.name,
          color: config.color,
          position: config.position,
          isDefault: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        
        columnMap[status] = columnId
      }
      
      // Update tasks to use columnId
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspace._id))
        .collect()
      
      console.log(`Updating ${tasks.length} tasks for workspace ${workspace._id}...`)
      
      for (const task of tasks) {
        const columnId = columnMap[task.status]
        if (columnId) {
          await ctx.db.patch(task._id, {
            columnId,
            updatedAt: new Date().toISOString(),
          })
        }
      }
    }
    
    console.log("Workspace column migration completed!")
  },
})

// Helper function to map old status to column ID for a workspace
export const getColumnIdForStatus = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done")
    ),
  },
  handler: async (ctx, args) => {
    // Try to find a column that matches the old status name
    const statusConfig = STATUS_TO_COLUMN[args.status]
    
    const column = await ctx.db
      .query("columns")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("name"), statusConfig.name))
      .first()
    
    if (!column) {
      // If no matching column found, create default columns
      console.log(`No matching column found for status ${args.status}, creating defaults...`)
      
      for (const [status, config] of Object.entries(STATUS_TO_COLUMN)) {
        await ctx.db.insert("columns", {
          workspaceId: args.workspaceId,
          name: config.name,
          color: config.color,
          position: config.position,
          isDefault: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
      
      // Try again
      const newColumn = await ctx.db
        .query("columns")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
        .filter((q) => q.eq(q.field("name"), statusConfig.name))
        .first()
      
      return newColumn?._id || null
    }
    
    return column._id
  },
})
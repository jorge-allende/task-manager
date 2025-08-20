import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getCurrentUserOrThrow } from "./users";

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

  // For now, all members can perform tag operations
  // Later we can add more granular permissions based on role
  return { user, member };
}

// Create a new workspace tag
export const createTag = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    color: v.string(), // Hex color or Tailwind class
  },
  handler: async (ctx, args) => {
    const { user } = await ensureWorkspaceAccess(
      ctx,
      args.workspaceId,
      "tags.create"
    );

    // Check if tag with same name already exists
    const existingTag = await ctx.db
      .query("workspaceTags")
      .withIndex("byWorkspaceAndName", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("name", args.name)
      )
      .first();

    if (existingTag) {
      throw new Error("A tag with this name already exists in the workspace");
    }

    // Validate color format (basic validation)
    const isHexColor = /^#[0-9A-F]{6}$/i.test(args.color);
    const isTailwindClass = args.color.startsWith("bg-") || args.color.startsWith("text-");
    
    if (!isHexColor && !isTailwindClass) {
      throw new Error("Color must be a hex color code or a Tailwind class");
    }

    const tagId = await ctx.db.insert("workspaceTags", {
      workspaceId: args.workspaceId,
      name: args.name.trim(),
      color: args.color,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return tagId;
  },
});

// Update a tag
export const updateTag = mutation({
  args: {
    id: v.id("workspaceTags"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tag = await ctx.db.get(args.id);
    if (!tag) {
      throw new Error("Tag not found");
    }

    await ensureWorkspaceAccess(ctx, tag.workspaceId, "tags.update");

    const updates: Partial<Doc<"workspaceTags">> = {
      updatedAt: new Date().toISOString(),
    };

    if (args.name !== undefined) {
      // Check if new name already exists
      const existingTag = await ctx.db
        .query("workspaceTags")
        .withIndex("byWorkspaceAndName", (q) =>
          q.eq("workspaceId", tag.workspaceId).eq("name", args.name!)
        )
        .filter((q) => q.neq(q.field("_id"), args.id))
        .first();

      if (existingTag) {
        throw new Error("A tag with this name already exists in the workspace");
      }

      updates.name = args.name.trim();
    }

    if (args.color !== undefined) {
      // Validate color format
      const isHexColor = /^#[0-9A-F]{6}$/i.test(args.color);
      const isTailwindClass = args.color.startsWith("bg-") || args.color.startsWith("text-");
      
      if (!isHexColor && !isTailwindClass) {
        throw new Error("Color must be a hex color code or a Tailwind class");
      }

      updates.color = args.color;
    }

    await ctx.db.patch(args.id, updates);
  },
});

// Delete a tag
export const deleteTag = mutation({
  args: {
    id: v.id("workspaceTags"),
  },
  handler: async (ctx, args) => {
    const tag = await ctx.db.get(args.id);
    if (!tag) {
      throw new Error("Tag not found");
    }

    const { member } = await ensureWorkspaceAccess(
      ctx,
      tag.workspaceId,
      "tags.delete"
    );

    // Only owners and admins can delete tags
    if (member.role !== "owner" && member.role !== "admin") {
      throw new Error("Only workspace owners and admins can delete tags");
    }

    // Find all tasks using this tag
    const tasksWithTag = await ctx.db
      .query("tasks")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", tag.workspaceId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    // Remove the tag from all tasks
    const tagName = tag.name;
    for (const task of tasksWithTag) {
      if (task.tags && task.tags.includes(tagName)) {
        const updatedTags = task.tags.filter(t => t !== tagName);
        await ctx.db.patch(task._id, {
          tags: updatedTags.length > 0 ? updatedTags : undefined,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Delete the tag
    await ctx.db.delete(args.id);
  },
});

// Get all tags for a workspace
export const getTags = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await ensureWorkspaceAccess(ctx, args.workspaceId, "tags.view");

    const tags = await ctx.db
      .query("workspaceTags")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // Sort by name
    return tags.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Get tag by name (for validation)
export const getTagByName = query({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await ensureWorkspaceAccess(ctx, args.workspaceId, "tags.view");

    return await ctx.db
      .query("workspaceTags")
      .withIndex("byWorkspaceAndName", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("name", args.name)
      )
      .first();
  },
});

// Bulk create tags (useful for initial setup or import)
export const bulkCreateTags = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    tags: v.array(v.object({
      name: v.string(),
      color: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const { member } = await ensureWorkspaceAccess(
      ctx,
      args.workspaceId,
      "tags.create"
    );

    // Only owners and admins can bulk create tags
    if (member.role !== "owner" && member.role !== "admin") {
      throw new Error("Only workspace owners and admins can bulk create tags");
    }

    const createdTags: Id<"workspaceTags">[] = [];
    const errors: string[] = [];

    for (const tagData of args.tags) {
      try {
        // Check if tag already exists
        const existingTag = await ctx.db
          .query("workspaceTags")
          .withIndex("byWorkspaceAndName", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("name", tagData.name)
          )
          .first();

        if (existingTag) {
          errors.push(`Tag "${tagData.name}" already exists`);
          continue;
        }

        // Validate color
        const isHexColor = /^#[0-9A-F]{6}$/i.test(tagData.color);
        const isTailwindClass = tagData.color.startsWith("bg-") || tagData.color.startsWith("text-");
        
        if (!isHexColor && !isTailwindClass) {
          errors.push(`Invalid color for tag "${tagData.name}"`);
          continue;
        }

        const tagId = await ctx.db.insert("workspaceTags", {
          workspaceId: args.workspaceId,
          name: tagData.name.trim(),
          color: tagData.color,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        createdTags.push(tagId);
      } catch (error) {
        errors.push(`Failed to create tag "${tagData.name}": ${error}`);
      }
    }

    return {
      created: createdTags.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
});

// Get tag usage statistics
export const getTagStats = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await ensureWorkspaceAccess(ctx, args.workspaceId, "tags.view");

    const [tags, tasks] = await Promise.all([
      ctx.db
        .query("workspaceTags")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect(),
      ctx.db
        .query("tasks")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect(),
    ]);

    // Count usage for each tag
    const tagStats = tags.map(tag => {
      const count = tasks.filter(task => 
        task.tags && task.tags.includes(tag.name)
      ).length;

      return {
        ...tag,
        taskCount: count,
      };
    });

    // Sort by usage count (descending) and then by name
    return tagStats.sort((a, b) => {
      if (b.taskCount !== a.taskCount) {
        return b.taskCount - a.taskCount;
      }
      return a.name.localeCompare(b.name);
    });
  },
});
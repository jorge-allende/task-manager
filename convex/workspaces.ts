import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import { Id } from "./_generated/dataModel";

// Default columns for new workspaces
const DEFAULT_COLUMNS = [
  { name: "To Do", color: "bg-gray-500", position: 0 },
  { name: "In Progress", color: "bg-blue-500", position: 1 },
  { name: "Done", color: "bg-green-500", position: 2 },
];

// Create a new workspace
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    settings: v.optional(v.object({
      defaultView: v.optional(v.union(v.literal("kanban"), v.literal("calendar"), v.literal("list"))),
      timezone: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Create the workspace
    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.name,
      description: args.description,
      ownerId: user._id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      settings: args.settings,
    });

    // Add the creator as the owner member
    await ctx.db.insert("workspaceMembers", {
      workspaceId,
      userId: user._id,
      role: "owner",
      joinedAt: new Date().toISOString(),
      isActive: true,
    });

    // Initialize default columns for the workspace
    for (const defaultColumn of DEFAULT_COLUMNS) {
      await ctx.db.insert("columns", {
        workspaceId,
        name: defaultColumn.name,
        color: defaultColumn.color,
        position: defaultColumn.position,
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return workspaceId;
  },
});

// Get all workspaces for the current user
export const list = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Get all workspace memberships for the user
    let membershipQuery = ctx.db
      .query("workspaceMembers")
      .withIndex("byUserAndActive", (q) => q.eq("userId", user._id).eq("isActive", true));
    
    const memberships = await membershipQuery.collect();
    
    // Get workspace details for each membership
    const workspaces = await Promise.all(
      memberships.map(async (membership) => {
        const workspace = await ctx.db.get(membership.workspaceId);
        if (!workspace || (!args.includeInactive && !workspace.isActive)) {
          return null;
        }
        
        // Get member count
        const memberCount = await ctx.db
          .query("workspaceMembers")
          .withIndex("byWorkspace", (q) => q.eq("workspaceId", membership.workspaceId))
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect()
          .then((members) => members.length);
        
        return {
          ...workspace,
          _id: membership.workspaceId,
          role: membership.role,
          joinedAt: membership.joinedAt,
          memberCount,
        };
      })
    );
    
    return workspaces.filter((w) => w !== null);
  },
});

// Get a single workspace by ID
export const get = query({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Check if user has access to this workspace
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) => 
        q.eq("workspaceId", args.id).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!membership) {
      throw new Error("You don't have access to this workspace");
    }
    
    const workspace = await ctx.db.get(args.id);
    if (!workspace) {
      throw new Error("Workspace not found");
    }
    
    // Get member count and owner details
    const [memberCount, owner] = await Promise.all([
      ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.id))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect()
        .then((members) => members.length),
      ctx.db.get(workspace.ownerId),
    ]);
    
    return {
      ...workspace,
      role: membership.role,
      memberCount,
      owner,
    };
  },
});

// Update workspace details
export const update = mutation({
  args: {
    id: v.id("workspaces"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    settings: v.optional(v.object({
      defaultView: v.optional(v.union(v.literal("kanban"), v.literal("calendar"), v.literal("list"))),
      timezone: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Check if user has admin or owner access
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) => 
        q.eq("workspaceId", args.id).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throw new Error("You don't have permission to update this workspace");
    }
    
    const workspace = await ctx.db.get(args.id);
    if (!workspace) {
      throw new Error("Workspace not found");
    }
    
    const updates: any = {
      updatedAt: new Date().toISOString(),
    };
    
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.settings !== undefined) {
      updates.settings = {
        ...workspace.settings,
        ...args.settings,
      };
    }
    
    await ctx.db.patch(args.id, updates);
    
    return { success: true };
  },
});

// Soft delete (deactivate) a workspace
export const deactivate = mutation({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Only owner can deactivate
    const workspace = await ctx.db.get(args.id);
    if (!workspace) {
      throw new Error("Workspace not found");
    }
    
    if (workspace.ownerId !== user._id) {
      throw new Error("Only the workspace owner can deactivate it");
    }
    
    // Deactivate workspace
    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAt: new Date().toISOString(),
    });
    
    // Deactivate all memberships
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.id))
      .collect();
    
    await Promise.all(
      memberships.map((membership) =>
        ctx.db.patch(membership._id, { isActive: false })
      )
    );
    
    return { success: true };
  },
});

// Reactivate a workspace
export const reactivate = mutation({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Only owner can reactivate
    const workspace = await ctx.db.get(args.id);
    if (!workspace) {
      throw new Error("Workspace not found");
    }
    
    if (workspace.ownerId !== user._id) {
      throw new Error("Only the workspace owner can reactivate it");
    }
    
    // Reactivate workspace
    await ctx.db.patch(args.id, {
      isActive: true,
      updatedAt: new Date().toISOString(),
    });
    
    // Reactivate owner membership only
    const ownerMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) => 
        q.eq("workspaceId", args.id).eq("userId", user._id)
      )
      .first();
    
    if (ownerMembership) {
      await ctx.db.patch(ownerMembership._id, { isActive: true });
    }
    
    return { success: true };
  },
});

// Transfer workspace ownership
export const transferOwnership = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    newOwnerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Verify current user is the owner
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }
    
    if (workspace.ownerId !== user._id) {
      throw new Error("Only the current owner can transfer ownership");
    }
    
    // Verify new owner is a member
    const newOwnerMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("userId", args.newOwnerId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!newOwnerMembership) {
      throw new Error("New owner must be an active member of the workspace");
    }
    
    // Update workspace owner
    await ctx.db.patch(args.workspaceId, {
      ownerId: args.newOwnerId,
      updatedAt: new Date().toISOString(),
    });
    
    // Update roles: new owner becomes owner, old owner becomes admin
    await ctx.db.patch(newOwnerMembership._id, { role: "owner" });
    
    const oldOwnerMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (oldOwnerMembership) {
      await ctx.db.patch(oldOwnerMembership._id, { role: "admin" });
    }
    
    return { success: true };
  },
});
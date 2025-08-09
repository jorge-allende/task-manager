import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserOrThrow } from "./users";
import { Id } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";

// Role hierarchy for permission checks
const roleHierarchy = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

// Check if a user has permission in a workspace
export const checkPermission = query({
  args: {
    workspaceId: v.id("workspaces"),
    requiredRole: v.union(v.literal("owner"), v.literal("admin"), v.literal("member"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!membership) {
      return { hasPermission: false, role: null };
    }
    
    const hasPermission = roleHierarchy[membership.role] >= roleHierarchy[args.requiredRole];
    return { hasPermission, role: membership.role };
  },
});

// List all members of a workspace
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    role: v.optional(v.union(v.literal("owner"), v.literal("admin"), v.literal("member"), v.literal("viewer"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Check if user has access to view members
    const userMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!userMembership) {
      throw new Error("You don't have access to this workspace");
    }
    
    // Build query
    let membersQuery = ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("isActive"), true));
    
    if (args.role) {
      membersQuery = membersQuery.filter((q) => q.eq(q.field("role"), args.role));
    }
    
    const paginatedMembers = await membersQuery.paginate(args.paginationOpts);
    
    // Enrich with user data
    const enrichedMembers = await Promise.all(
      paginatedMembers.page.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        const invitedByUser = member.invitedBy ? await ctx.db.get(member.invitedBy) : null;
        
        return {
          ...member,
          user,
          invitedByUser,
        };
      })
    );
    
    return {
      ...paginatedMembers,
      page: enrichedMembers,
    };
  },
});

// Add a member to a workspace
export const add = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    // Check if current user has admin or owner permission
    const currentUserMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("userId", currentUser._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!currentUserMembership || 
        (currentUserMembership.role !== "owner" && currentUserMembership.role !== "admin")) {
      throw new Error("You don't have permission to add members to this workspace");
    }
    
    // Check if user is already a member
    const existingMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .first();
    
    if (existingMembership && existingMembership.isActive) {
      throw new Error("User is already a member of this workspace");
    }
    
    // Verify the workspace exists and is active
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || !workspace.isActive) {
      throw new Error("Workspace not found or inactive");
    }
    
    // Verify the user exists
    const userToAdd = await ctx.db.get(args.userId);
    if (!userToAdd) {
      throw new Error("User not found");
    }
    
    if (existingMembership && !existingMembership.isActive) {
      // Reactivate existing membership
      await ctx.db.patch(existingMembership._id, {
        role: args.role,
        isActive: true,
        invitedBy: currentUser._id,
        joinedAt: new Date().toISOString(),
      });
      return existingMembership._id;
    } else {
      // Create new membership
      const membershipId = await ctx.db.insert("workspaceMembers", {
        workspaceId: args.workspaceId,
        userId: args.userId,
        role: args.role,
        joinedAt: new Date().toISOString(),
        invitedBy: currentUser._id,
        isActive: true,
      });
      return membershipId;
    }
  },
});

// Update a member's role
export const updateRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    newRole: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    // Check if current user has permission
    const currentUserMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("userId", currentUser._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!currentUserMembership || 
        (currentUserMembership.role !== "owner" && currentUserMembership.role !== "admin")) {
      throw new Error("You don't have permission to update member roles");
    }
    
    // Find the member to update
    const memberToUpdate = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!memberToUpdate) {
      throw new Error("Member not found in this workspace");
    }
    
    // Can't change owner role through this mutation
    if (memberToUpdate.role === "owner") {
      throw new Error("Cannot change owner role. Use transferOwnership instead.");
    }
    
    // Admins can't promote to admin
    if (currentUserMembership.role === "admin" && args.newRole === "admin") {
      throw new Error("Only owners can promote members to admin");
    }
    
    await ctx.db.patch(memberToUpdate._id, { role: args.newRole });
    
    return { success: true };
  },
});

// Remove a member from a workspace
export const remove = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    
    // Check if current user has permission
    const currentUserMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("userId", currentUser._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!currentUserMembership) {
      throw new Error("You don't have access to this workspace");
    }
    
    // Users can remove themselves, admins/owners can remove others
    const canRemove = args.userId === currentUser._id || 
                     currentUserMembership.role === "owner" || 
                     currentUserMembership.role === "admin";
    
    if (!canRemove) {
      throw new Error("You don't have permission to remove this member");
    }
    
    // Find the member to remove
    const memberToRemove = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!memberToRemove) {
      throw new Error("Member not found in this workspace");
    }
    
    // Can't remove the owner
    if (memberToRemove.role === "owner") {
      throw new Error("Cannot remove the workspace owner");
    }
    
    // Admins can't remove other admins
    if (currentUserMembership.role === "admin" && memberToRemove.role === "admin") {
      throw new Error("Admins cannot remove other admins");
    }
    
    // Soft delete the membership
    await ctx.db.patch(memberToRemove._id, { isActive: false });
    
    return { success: true };
  },
});

// Get member statistics for a workspace
export const getStats = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Check if user has access
    const userMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!userMembership) {
      throw new Error("You don't have access to this workspace");
    }
    
    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const stats = {
      total: members.length,
      byRole: {
        owner: members.filter(m => m.role === "owner").length,
        admin: members.filter(m => m.role === "admin").length,
        member: members.filter(m => m.role === "member").length,
        viewer: members.filter(m => m.role === "viewer").length,
      },
    };
    
    return stats;
  },
});

// Leave a workspace (for the current user)
export const leave = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) => 
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!membership) {
      throw new Error("You are not a member of this workspace");
    }
    
    // Owners can't leave, they must transfer ownership first
    if (membership.role === "owner") {
      throw new Error("Owners cannot leave. Transfer ownership first.");
    }
    
    // Soft delete the membership
    await ctx.db.patch(membership._id, { isActive: false });
    
    return { success: true };
  },
});
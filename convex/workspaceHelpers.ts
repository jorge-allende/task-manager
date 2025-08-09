import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getCurrentUserOrThrow } from "./users";

// Role types
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

// Role hierarchy for permission checks
export const roleHierarchy: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

// Permission types
export type Permission = 
  | "workspace.view"
  | "workspace.update"
  | "workspace.delete"
  | "workspace.members.view"
  | "workspace.members.add"
  | "workspace.members.remove"
  | "workspace.members.updateRole"
  | "tasks.view"
  | "tasks.create"
  | "tasks.update"
  | "tasks.delete"
  | "comments.view"
  | "comments.create"
  | "comments.update"
  | "comments.delete";

// Permission matrix
export const permissionMatrix: Record<WorkspaceRole, Permission[]> = {
  owner: [
    "workspace.view",
    "workspace.update",
    "workspace.delete",
    "workspace.members.view",
    "workspace.members.add",
    "workspace.members.remove",
    "workspace.members.updateRole",
    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tasks.delete",
    "comments.view",
    "comments.create",
    "comments.update",
    "comments.delete",
  ],
  admin: [
    "workspace.view",
    "workspace.update",
    "workspace.members.view",
    "workspace.members.add",
    "workspace.members.remove",
    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tasks.delete",
    "comments.view",
    "comments.create",
    "comments.update",
    "comments.delete",
  ],
  member: [
    "workspace.view",
    "workspace.members.view",
    "tasks.view",
    "tasks.create",
    "tasks.update",
    "comments.view",
    "comments.create",
    "comments.update",
  ],
  viewer: [
    "workspace.view",
    "workspace.members.view",
    "tasks.view",
    "comments.view",
  ],
};

// Check if a role has a specific permission
export function hasPermission(role: WorkspaceRole, permission: Permission): boolean {
  return permissionMatrix[role].includes(permission);
}

// Get user's membership in a workspace
export async function getUserWorkspaceMembership(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">
) {
  return await ctx.db
    .query("workspaceMembers")
    .withIndex("byWorkspaceAndUser", (q) => 
      q.eq("workspaceId", workspaceId).eq("userId", userId)
    )
    .filter((q) => q.eq(q.field("isActive"), true))
    .first();
}

// Get current user's membership in a workspace
export async function getCurrentUserWorkspaceMembership(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
) {
  const user = await getCurrentUserOrThrow(ctx);
  return getUserWorkspaceMembership(ctx, user._id, workspaceId);
}

// Ensure user has access to workspace
export async function ensureWorkspaceAccess(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  requiredPermission?: Permission
): Promise<{
  workspace: any;
  membership: any;
  user: any;
}> {
  const user = await getCurrentUserOrThrow(ctx);
  const membership = await getUserWorkspaceMembership(ctx, user._id, workspaceId);
  
  if (!membership) {
    throw new Error("You don't have access to this workspace");
  }
  
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace || !workspace.isActive) {
    throw new Error("Workspace not found or inactive");
  }
  
  // Check specific permission if required
  if (requiredPermission && !hasPermission(membership.role, requiredPermission)) {
    throw new Error(`You don't have permission to ${requiredPermission}`);
  }
  
  return { workspace, membership, user };
}

// Check if user can perform an action on another user in the workspace
export function canManageUser(
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole,
  action: "remove" | "updateRole"
): boolean {
  // Can't act on owners
  if (targetRole === "owner") return false;
  
  // Owners can manage anyone
  if (actorRole === "owner") return true;
  
  // Admins can manage members and viewers
  if (actorRole === "admin") {
    return roleHierarchy[targetRole] < roleHierarchy[actorRole];
  }
  
  // Others can't manage users
  return false;
}

// Get all active workspaces for a user
export async function getUserWorkspaces(
  ctx: QueryCtx,
  userId: Id<"users">
) {
  const memberships = await ctx.db
    .query("workspaceMembers")
    .withIndex("byUserAndActive", (q) => q.eq("userId", userId).eq("isActive", true))
    .collect();
  
  const workspaces = await Promise.all(
    memberships.map(async (membership) => {
      const workspace = await ctx.db.get(membership.workspaceId);
      if (!workspace || !workspace.isActive) return null;
      
      return {
        ...workspace,
        _id: membership.workspaceId,
        role: membership.role,
        joinedAt: membership.joinedAt,
      };
    })
  );
  
  return workspaces.filter((w) => w !== null);
}

// Batch check permissions for multiple workspaces
export async function batchCheckWorkspaceAccess(
  ctx: QueryCtx,
  userId: Id<"users">,
  workspaceIds: Id<"workspaces">[]
): Promise<Map<Id<"workspaces">, WorkspaceRole | null>> {
  const result = new Map<Id<"workspaces">, WorkspaceRole | null>();
  
  // Initialize all workspace IDs with null
  workspaceIds.forEach(id => result.set(id, null));
  
  // Get all memberships for the user
  const allMemberships = await ctx.db
    .query("workspaceMembers")
    .withIndex("byUserAndActive", (q) => q.eq("userId", userId).eq("isActive", true))
    .collect();
  
  // Filter by workspace IDs in JavaScript
  const memberships = allMemberships.filter(m => 
    workspaceIds.includes(m.workspaceId)
  );
  
  // Update the map with actual roles
  memberships.forEach(membership => {
    result.set(membership.workspaceId, membership.role);
  });
  
  return result;
}

// Helper to format workspace with additional metadata
export async function enrichWorkspaceData(
  ctx: QueryCtx,
  workspace: any,
  includeMembers: boolean = false
) {
  const enriched: any = { ...workspace };
  
  // Get member count
  enriched.memberCount = await ctx.db
    .query("workspaceMembers")
    .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspace._id))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect()
    .then((members) => members.length);
  
  // Get owner details
  enriched.owner = await ctx.db.get(workspace.ownerId);
  
  // Get member list if requested
  if (includeMembers) {
    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", workspace._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    enriched.members = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        return {
          ...member,
          user,
        };
      })
    );
  }
  
  return enriched;
}
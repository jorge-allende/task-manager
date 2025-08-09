// Re-export all workspace-related functions for convenient importing
export * as workspaces from "./workspaces";
export * as workspaceMembers from "./workspaceMembers";
export * from "./workspaceHelpers";

// Example usage in React components:
/*
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// List workspaces
const workspaces = useQuery(api.workspaces.list, { includeInactive: false });

// Create workspace
const createWorkspace = useMutation(api.workspaces.create);
await createWorkspace({ 
  name: "My Workspace",
  description: "Team collaboration space"
});

// Check permissions
const permission = useQuery(api.workspaceMembers.checkPermission, {
  workspaceId: "workspace123",
  requiredRole: "admin"
});

// Add member
const addMember = useMutation(api.workspaceMembers.add);
await addMember({
  workspaceId: "workspace123",
  userId: "user456",
  role: "member"
});
*/
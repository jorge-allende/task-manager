import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { paymentAttemptSchemaValidator } from "./paymentAttemptTypes";

export default defineSchema({
    users: defineTable({
      name: v.string(),
      // this the Clerk ID, stored in the subject JWT field
      externalId: v.string(),
    }).index("byExternalId", ["externalId"]),
    
    paymentAttempts: defineTable(paymentAttemptSchemaValidator)
      .index("byPaymentId", ["payment_id"])
      .index("byUserId", ["userId"])
      .index("byPayerUserId", ["payer.user_id"]),

    workspaces: defineTable({
      name: v.string(),
      description: v.optional(v.string()),
      ownerId: v.id("users"),
      createdAt: v.string(),
      updatedAt: v.string(),
      isActive: v.boolean(),
      settings: v.optional(v.object({
        defaultView: v.optional(v.union(v.literal("kanban"), v.literal("calendar"), v.literal("list"))),
        timezone: v.optional(v.string()),
      })),
    })
      .index("byOwner", ["ownerId"])
      .index("byActiveStatus", ["isActive"]),

    workspaceMembers: defineTable({
      workspaceId: v.id("workspaces"),
      userId: v.id("users"),
      role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member"), v.literal("viewer")),
      joinedAt: v.string(),
      invitedBy: v.optional(v.id("users")),
      isActive: v.boolean(),
    })
      .index("byWorkspace", ["workspaceId"])
      .index("byUser", ["userId"])
      .index("byWorkspaceAndUser", ["workspaceId", "userId"])
      .index("byWorkspaceAndRole", ["workspaceId", "role"])
      .index("byUserAndActive", ["userId", "isActive"]),
    
    // Kanban columns - dynamic columns per workspace
    columns: defineTable({
      workspaceId: v.id("workspaces"),
      name: v.string(),
      color: v.string(), // Tailwind color class (e.g., "bg-blue-500")
      position: v.number(), // For ordering columns
      isDefault: v.boolean(), // Mark system default columns
      createdAt: v.string(),
      updatedAt: v.string(),
    })
      .index("byWorkspace", ["workspaceId"])
      .index("byWorkspaceAndPosition", ["workspaceId", "position"]),
    
    // Kanban tasks
    tasks: defineTable({
      workspaceId: v.id("workspaces"),
      title: v.string(),
      description: v.optional(v.string()),
      status: v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("review"),
        v.literal("done")
      ),
      columnId: v.optional(v.id("columns")), // New field for dynamic columns
      priority: v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent")
      ),
      assignedTo: v.optional(v.array(v.id("users"))),
      createdBy: v.id("users"),
      dueDate: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      attachments: v.optional(v.array(v.string())), // URLs or file IDs
      position: v.number(), // For ordering within a column
      createdAt: v.string(),
      updatedAt: v.string(),
      completedAt: v.optional(v.string()),
      isArchived: v.boolean(),
    })
      .index("byWorkspace", ["workspaceId"])
      .index("byWorkspaceAndStatus", ["workspaceId", "status"])
      .index("byWorkspaceAndColumn", ["workspaceId", "columnId"])
      .index("byWorkspaceAndPriority", ["workspaceId", "priority"])
      .index("byWorkspaceAndCreator", ["workspaceId", "createdBy"])
      .index("byWorkspaceAndArchived", ["workspaceId", "isArchived"])
      .index("byWorkspaceStatusPosition", ["workspaceId", "status", "position"])
      .index("byWorkspaceColumnPosition", ["workspaceId", "columnId", "position"]),
    
    // Task comments
    comments: defineTable({
      taskId: v.id("tasks"),
      workspaceId: v.id("workspaces"),
      userId: v.id("users"),
      content: v.string(),
      mentions: v.optional(v.array(v.id("users"))),
      createdAt: v.string(),
      updatedAt: v.string(),
      isEdited: v.boolean(),
      isDeleted: v.boolean(),
    })
      .index("byTask", ["taskId"])
      .index("byWorkspace", ["workspaceId"])
      .index("byUser", ["userId"])
      .index("byTaskAndDeleted", ["taskId", "isDeleted"]),
    
    // Workspace invitations
    invitations: defineTable({
      workspaceId: v.id("workspaces"),
      email: v.string(),
      role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
      invitedBy: v.id("users"),
      token: v.string(), // Unique invitation token
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("declined"),
        v.literal("expired")
      ),
      expiresAt: v.string(),
      createdAt: v.string(),
      acceptedAt: v.optional(v.string()),
    })
      .index("byWorkspace", ["workspaceId"])
      .index("byEmail", ["email"])
      .index("byToken", ["token"])
      .index("byStatus", ["status"])
      .index("byWorkspaceAndStatus", ["workspaceId", "status"]),
  });
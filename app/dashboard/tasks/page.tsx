"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { TasksTable } from "@/components/TasksTable";
import { TaskFilters } from "@/components/TaskFilters";
import { BulkActions } from "@/components/BulkActions";
import { TaskStats } from "@/components/TaskStats";
import { TaskCreateDialog } from "@/components/TaskCreateDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

export default function TasksPage() {
  const { currentWorkspace, isLoading: isWorkspaceLoading, error: workspaceError } = useWorkspace();
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>();
  const [assigneeFilter, setAssigneeFilter] = useState<Id<"users"> | undefined>();
  const [tagsFilter, setTagsFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selection state for bulk actions
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<Id<"tasks">>>(new Set());
  
  // Create task dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Get tasks with filters
  const tasksQuery = useQuery(
    api.tasks.list,
    currentWorkspace
      ? {
          workspaceId: currentWorkspace._id,
          status: statusFilter as any,
          priority: priorityFilter as any,
          search: searchQuery || undefined,
          tags: tagsFilter.length > 0 ? tagsFilter : undefined,
          includeArchived: false,
          paginationOpts: { numItems: 100, cursor: null },
        }
      : "skip"
  );
  
  // Get task statistics
  const stats = useQuery(
    api.tasks.getStats,
    currentWorkspace ? { workspaceId: currentWorkspace._id } : "skip"
  );
  
  // Get workspace members for assignee filter
  const members = useQuery(
    api.workspaceMembers.list,
    currentWorkspace ? { 
      workspaceId: currentWorkspace._id,
      paginationOpts: { numItems: 100, cursor: null }
    } : "skip"
  );
  
  if (isWorkspaceLoading || !tasksQuery || !stats || !members) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }
  
  if (workspaceError) {
    return (
      <div className="flex-1 p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {workspaceError.message || 'Failed to load workspace. Please try again.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="flex-1 p-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a workspace to view tasks.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  const handleSelectionChange = (taskId: Id<"tasks">, selected: boolean) => {
    const newSelection = new Set(selectedTaskIds);
    if (selected) {
      newSelection.add(taskId);
    } else {
      newSelection.delete(taskId);
    }
    setSelectedTaskIds(newSelection);
  };
  
  const handleSelectAll = (selected: boolean) => {
    if (selected && tasksQuery.page) {
      const allIds = new Set(tasksQuery.page.map(task => task._id));
      setSelectedTaskIds(allIds);
    } else {
      setSelectedTaskIds(new Set());
    }
  };
  
  const handleBulkActionComplete = () => {
    setSelectedTaskIds(new Set());
  };
  
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tasks</h2>
          <p className="text-muted-foreground">
            Manage and track all tasks in {currentWorkspace.name}
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>
      
      {/* Task Statistics */}
      <TaskStats stats={stats} />
      
      {/* Filters */}
      <TaskFilters
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        assigneeFilter={assigneeFilter}
        tagsFilter={tagsFilter}
        searchQuery={searchQuery}
        members={members.page?.filter(m => m.user).map(m => ({
          user: {
            _id: m.user!._id,
            name: m.user!.name
          },
          role: m.role
        })) || []}
        onStatusChange={setStatusFilter}
        onPriorityChange={setPriorityFilter}
        onAssigneeChange={setAssigneeFilter}
        onTagsChange={setTagsFilter}
        onSearchChange={setSearchQuery}
      />
      
      {/* Bulk Actions */}
      {selectedTaskIds.size > 0 && (
        <BulkActions
          selectedTaskIds={Array.from(selectedTaskIds)}
          workspaceId={currentWorkspace._id}
          onComplete={handleBulkActionComplete}
        />
      )}
      
      {/* Tasks Table */}
      <TasksTable
        tasks={tasksQuery.page?.map(task => ({
          ...task,
          assignees: task.assignees?.filter(a => a !== null).map(a => ({
            _id: a!._id,
            name: a!.name
          })) || [],
          creator: task.creator ? {
            _id: task.creator._id,
            name: task.creator.name
          } : undefined
        })) || []}
        selectedTaskIds={selectedTaskIds}
        onSelectionChange={handleSelectionChange}
        onSelectAll={handleSelectAll}
        isLoading={false}
      />
      
      {/* Create Task Dialog */}
      <TaskCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        workspaceId={currentWorkspace._id}
      />
    </div>
  );
}
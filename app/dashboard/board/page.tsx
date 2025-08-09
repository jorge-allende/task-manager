'use client'

import { useState } from 'react'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconPlus } from '@tabler/icons-react'
import { TaskCreateDialog } from '@/components/TaskCreateDialog'

export default function BoardPage() {
  const { currentWorkspace, isLoading, error } = useWorkspace()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-10 w-[120px]" />
        </div>
        <div className="flex gap-6 overflow-x-auto">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-80">
              <Skeleton className="h-12 w-full mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error.message || 'Failed to load workspace. Please try again.'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!currentWorkspace) {
    return (
      <div className="flex-1 p-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No workspace selected. Please select a workspace from the sidebar.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="p-8 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Kanban Board</h2>
            <p className="text-muted-foreground mt-2">
              Drag and drop tasks between columns or reorder within columns. Supports keyboard navigation.
            </p>
          </div>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="ml-4"
          >
            <IconPlus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <KanbanBoard workspaceId={currentWorkspace._id} />
      </div>
      {currentWorkspace && (
        <TaskCreateDialog 
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          workspaceId={currentWorkspace._id}
        />
      )}
    </div>
  )
}
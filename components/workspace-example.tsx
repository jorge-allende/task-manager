'use client'

import { useWorkspace } from '@/hooks/use-workspace'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, Users, Settings } from 'lucide-react'

/**
 * Example component showing how to use the WorkspaceProvider
 * This demonstrates loading states, workspace data access, and actions
 */
export function WorkspaceExample() {
  const {
    currentWorkspace,
    workspaceMembers,
    currentUserRole,
    workspaces,
    isLoading,
    isInitializing,
    isSwitching,
    error,
    switchWorkspace,
    createWorkspace,
  } = useWorkspace()

  // Handle loading states
  if (isInitializing) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  // Handle errors
  if (error) {
    return (
      <div className="p-6 text-red-600 flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        <span>Error: {error.message}</span>
      </div>
    )
  }

  // No workspace (shouldn't happen with auto-create)
  if (!currentWorkspace) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground mb-4">No workspace found</p>
        <Button
          onClick={async () => {
            try {
              await createWorkspace('My New Workspace', 'A workspace for my projects')
            } catch (err) {
              console.error('Failed to create workspace:', err)
            }
          }}
        >
          Create Workspace
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Current Workspace Info */}
      <div>
        <h2 className="text-2xl font-bold mb-2">{currentWorkspace.name}</h2>
        {currentWorkspace.description && (
          <p className="text-muted-foreground">{currentWorkspace.description}</p>
        )}
        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {currentWorkspace.memberCount} members
          </span>
          <span>Role: {currentUserRole}</span>
        </div>
      </div>

      {/* Workspace Actions */}
      {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Workspace Settings
          </Button>
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4 mr-2" />
            Manage Members
          </Button>
        </div>
      )}

      {/* Workspace Switcher */}
      {workspaces && workspaces.length > 1 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Switch Workspace</h3>
          <div className="space-y-2">
            {workspaces.map((workspace) => (
              <Button
                key={workspace._id}
                variant={workspace._id === currentWorkspace._id ? 'default' : 'outline'}
                size="sm"
                onClick={() => switchWorkspace(workspace._id)}
                disabled={isSwitching || workspace._id === currentWorkspace._id}
                className="w-full justify-start"
              >
                {workspace.name}
                {workspace._id === currentWorkspace._id && ' (Current)'}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Members List (if loaded) */}
      {workspaceMembers && (
        <div>
          <h3 className="text-sm font-medium mb-2">Members ({workspaceMembers.length})</h3>
          <div className="space-y-2">
            {workspaceMembers.slice(0, 5).map((member) => (
              <div key={member._id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">{member.user?.name || 'Unknown User'}</p>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                </div>
              </div>
            ))}
            {workspaceMembers.length > 5 && (
              <p className="text-sm text-muted-foreground">
                And {workspaceMembers.length - 5} more...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading indicator for background operations */}
      {isLoading && !isInitializing && (
        <div className="text-sm text-muted-foreground">
          Loading workspace data...
        </div>
      )}
    </div>
  )
}
'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { useAuth, useUser } from '@clerk/nextjs'
import { useWorkspaceStore } from '@/lib/stores/workspace.store'
import { toast } from 'sonner'

// Type definitions for better type safety
interface Workspace {
  _id: Id<'workspaces'>
  name: string
  description?: string
  ownerId: Id<'users'>
  createdAt: string
  updatedAt: string
  isActive: boolean
  settings?: {
    defaultView?: 'kanban' | 'calendar' | 'list'
    timezone?: string
  }
  role?: 'owner' | 'admin' | 'member' | 'viewer'
  joinedAt?: string
  memberCount?: number
}

interface WorkspaceMember {
  _id: Id<'workspaceMembers'>
  workspaceId: Id<'workspaces'>
  userId: Id<'users'>
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joinedAt: string
  invitedBy?: Id<'users'>
  isActive: boolean
  user?: {
    _id: Id<'users'>
    name: string
    externalId: string
  }
  invitedByUser?: {
    _id: Id<'users'>
    name: string
    externalId: string
  }
}

interface WorkspaceContextType {
  // Current workspace data
  currentWorkspace: Workspace | null
  workspaceMembers: WorkspaceMember[] | null
  currentUserRole: 'owner' | 'admin' | 'member' | 'viewer' | null
  
  // Workspace list
  workspaces: Workspace[] | null
  
  // Loading states
  isLoading: boolean
  isInitializing: boolean
  isSwitching: boolean
  
  // Error state
  error: Error | null
  
  // Actions
  switchWorkspace: (workspaceId: Id<'workspaces'>) => Promise<void>
  createWorkspace: (name: string, description?: string) => Promise<Id<'workspaces'>>
  refreshWorkspaces: () => void
  refreshMembers: () => void
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}

interface WorkspaceProviderProps {
  children: ReactNode
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const { isLoaded: isClerkLoaded, userId } = useAuth()
  const { user } = useUser()
  const store = useWorkspaceStore()
  
  // State for loading and errors
  const [isInitializing, setIsInitializing] = useState(true)
  const [isSwitching, setIsSwitching] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  // Convex queries
  const currentUser = useQuery(api.users.current, 
    isClerkLoaded && userId ? {} : 'skip'
  )
  
  const workspaces = useQuery(api.workspaces.list, 
    currentUser ? { includeInactive: false } : 'skip'
  )
  
  const currentWorkspaceData = useQuery(
    api.workspaces.get,
    store.currentWorkspace?._id 
      ? { id: store.currentWorkspace._id }
      : 'skip'
  )
  
  const workspaceMembers = useQuery(
    api.workspaceMembers.list,
    store.currentWorkspace?._id
      ? { 
          workspaceId: store.currentWorkspace._id,
          paginationOpts: { numItems: 100, cursor: null }
        }
      : 'skip'
  )
  
  // Convex mutations
  const createWorkspaceMutation = useMutation(api.workspaces.create)
  
  // Initialize workspace on first load
  useEffect(() => {
    async function initializeWorkspace() {
      if (!isClerkLoaded || !currentUser) {
        return
      }
      
      try {
        setIsInitializing(true)
        setError(null)
        
        // If we have workspaces loaded
        if (workspaces && workspaces.length > 0) {
          // Update the cached workspace list
          store.setWorkspaces(workspaces)
          
          // Check if we have a stored workspace ID
          const storedWorkspaceId = store.lastWorkspaceId
          
          if (storedWorkspaceId) {
            // Try to find the stored workspace
            const storedWorkspace = workspaces.find(w => w._id === storedWorkspaceId)
            if (storedWorkspace) {
              store.setCurrentWorkspace(storedWorkspace)
              return
            }
          }
          
          // Otherwise, select the first workspace
          store.setCurrentWorkspace(workspaces[0])
        } else if (workspaces && workspaces.length === 0) {
          // No workspaces exist, create one for the user
          try {
            const newWorkspaceId = await createWorkspaceMutation({
              name: `${user?.firstName || 'My'}'s Workspace`,
              description: 'Your first workspace',
            })
            
            // The workspace list will be refetched automatically
            toast.success('Welcome! Your workspace has been created.')
          } catch (err) {
            console.error('Failed to create initial workspace:', err)
            setError(err as Error)
            toast.error('Failed to create workspace. Please try again.')
          }
        }
      } catch (err) {
        console.error('Failed to initialize workspace:', err)
        setError(err as Error)
      } finally {
        setIsInitializing(false)
      }
    }
    
    initializeWorkspace()
  }, [isClerkLoaded, currentUser, workspaces])
  
  // Update current workspace data when it changes
  useEffect(() => {
    if (currentWorkspaceData && store.currentWorkspace?._id === currentWorkspaceData._id) {
      store.setCurrentWorkspace(currentWorkspaceData)
    }
  }, [currentWorkspaceData])
  
  // Update members when they change
  useEffect(() => {
    if (workspaceMembers?.page) {
      store.setMembers(workspaceMembers.page)
    }
  }, [workspaceMembers])
  
  // Switch workspace function
  const switchWorkspace = async (workspaceId: Id<'workspaces'>) => {
    try {
      setIsSwitching(true)
      setError(null)
      
      const workspace = workspaces?.find(w => w._id === workspaceId)
      if (!workspace) {
        throw new Error('Workspace not found')
      }
      
      store.setCurrentWorkspace(workspace)
      toast.success(`Switched to ${workspace.name}`)
    } catch (err) {
      console.error('Failed to switch workspace:', err)
      setError(err as Error)
      toast.error('Failed to switch workspace')
      throw err
    } finally {
      setIsSwitching(false)
    }
  }
  
  // Create workspace function
  const createWorkspace = async (name: string, description?: string) => {
    try {
      setError(null)
      
      const workspaceId = await createWorkspaceMutation({
        name,
        description,
      })
      
      toast.success('Workspace created successfully')
      return workspaceId
    } catch (err) {
      console.error('Failed to create workspace:', err)
      setError(err as Error)
      toast.error('Failed to create workspace')
      throw err
    }
  }
  
  // Get current user role
  const currentUserRole = currentUser ? store.getMemberRole(currentUser._id) : null
  
  // Loading state
  const isLoading = !isClerkLoaded || 
                   currentUser === undefined || 
                   workspaces === undefined ||
                   (store.currentWorkspace && currentWorkspaceData === undefined) ||
                   (store.currentWorkspace && workspaceMembers === undefined)
  
  const contextValue: WorkspaceContextType = {
    // Current workspace data
    currentWorkspace: store.currentWorkspace,
    workspaceMembers: workspaceMembers?.page || null,
    currentUserRole,
    
    // Workspace list
    workspaces: workspaces || null,
    
    // Loading states
    isLoading,
    isInitializing,
    isSwitching,
    
    // Error state
    error,
    
    // Actions
    switchWorkspace,
    createWorkspace,
    refreshWorkspaces: () => {
      // Convex will automatically refetch when data changes
      // This is a no-op but provided for compatibility
    },
    refreshMembers: () => {
      // Convex will automatically refetch when data changes
      // This is a no-op but provided for compatibility
    },
  }
  
  // Clear workspace data on logout
  useEffect(() => {
    if (isClerkLoaded && !userId) {
      store.clearWorkspaceData()
    }
  }, [isClerkLoaded, userId])
  
  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
    </WorkspaceContext.Provider>
  )
}
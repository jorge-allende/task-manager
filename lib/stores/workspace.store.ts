import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Id } from '@/convex/_generated/dataModel'

interface WorkspaceMember {
  _id: Id<'workspaceMembers'>
  userId: Id<'users'>
  workspaceId: Id<'workspaces'>
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joinedAt: string
  user?: {
    name: string
    email: string
    imageUrl?: string
  }
}

interface Workspace {
  _id: Id<'workspaces'>
  name: string
  ownerId: Id<'users'>
  createdAt: string
  updatedAt: string
  description?: string
}

interface WorkspaceState {
  // Current workspace
  currentWorkspace: Workspace | null
  setCurrentWorkspace: (workspace: Workspace | null) => void
  
  // Workspace members
  members: WorkspaceMember[]
  setMembers: (members: WorkspaceMember[]) => void
  addMember: (member: WorkspaceMember) => void
  removeMember: (memberId: Id<'workspaceMembers'>) => void
  updateMemberRole: (memberId: Id<'workspaceMembers'>, role: 'admin' | 'member') => void
  
  // Workspace switching
  lastWorkspaceId: Id<'workspaces'> | null
  setLastWorkspaceId: (id: Id<'workspaces'> | null) => void
  
  // Workspace list cache (for quick switching)
  workspaces: Workspace[]
  setWorkspaces: (workspaces: Workspace[]) => void
  
  // Utility functions
  isOwner: (userId: Id<'users'>) => boolean
  isAdmin: (userId: Id<'users'>) => boolean
  getMemberRole: (userId: Id<'users'>) => 'owner' | 'admin' | 'member' | 'viewer' | null
  
  // Clear all workspace data (for logout)
  clearWorkspaceData: () => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      currentWorkspace: null,
      members: [],
      lastWorkspaceId: null,
      workspaces: [],
      
      setCurrentWorkspace: (workspace) => {
        set({ 
          currentWorkspace: workspace,
          lastWorkspaceId: workspace?._id || null
        })
      },
      
      setMembers: (members) => set({ members }),
      
      addMember: (member) => set((state) => ({
        members: [...state.members, member]
      })),
      
      removeMember: (memberId) => set((state) => ({
        members: state.members.filter(m => m._id !== memberId)
      })),
      
      updateMemberRole: (memberId, role) => set((state) => ({
        members: state.members.map(m => 
          m._id === memberId ? { ...m, role } : m
        )
      })),
      
      setLastWorkspaceId: (id) => set({ lastWorkspaceId: id }),
      
      setWorkspaces: (workspaces) => set({ workspaces }),
      
      isOwner: (userId) => {
        const { currentWorkspace } = get()
        return currentWorkspace?.ownerId === userId
      },
      
      isAdmin: (userId) => {
        const { members, isOwner } = get()
        if (isOwner(userId)) return true
        
        const member = members.find(m => m.userId === userId)
        return member?.role === 'admin'
      },
      
      getMemberRole: (userId) => {
        const { currentWorkspace, members } = get()
        if (currentWorkspace?.ownerId === userId) return 'owner'
        
        const member = members.find(m => m.userId === userId)
        return member?.role || null
      },
      
      clearWorkspaceData: () => set({
        currentWorkspace: null,
        members: [],
        workspaces: [],
        // Keep lastWorkspaceId for next login
      }),
    }),
    {
      name: 'workspace-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist minimal data
        lastWorkspaceId: state.lastWorkspaceId,
        // Don't persist sensitive workspace data
      }),
    }
  )
)
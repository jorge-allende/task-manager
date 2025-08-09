import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type ModalType = 
  | 'createWorkspace'
  | 'editWorkspace'
  | 'deleteWorkspace'
  | 'inviteMembers'
  | 'createBoard'
  | 'editBoard'
  | 'deleteBoard'
  | 'createTask'
  | 'editTask'
  | 'deleteTask'
  | 'userSettings'
  | null

interface ModalData {
  [key: string]: any
}

interface UIPreferences {
  sidebarCollapsed: boolean
  showCompletedTasks: boolean
  taskViewMode: 'list' | 'board'
  boardDensity: 'compact' | 'comfortable' | 'spacious'
  showTaskLabels: boolean
  showTaskDueDates: boolean
  showTaskAssignees: boolean
}

interface UIState {
  // Sidebar state
  isSidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (isOpen: boolean) => void
  
  // Mobile menu state
  isMobileMenuOpen: boolean
  setMobileMenuOpen: (isOpen: boolean) => void
  
  // Modal state
  activeModal: ModalType
  modalData: ModalData
  openModal: (type: ModalType, data?: ModalData) => void
  closeModal: () => void
  
  // Loading states
  isNavigating: boolean
  setIsNavigating: (isNavigating: boolean) => void
  
  // UI Preferences
  preferences: UIPreferences
  updatePreference: <K extends keyof UIPreferences>(
    key: K,
    value: UIPreferences[K]
  ) => void
  resetPreferences: () => void
  
  // Command palette state
  isCommandPaletteOpen: boolean
  setCommandPaletteOpen: (isOpen: boolean) => void
  
  // Toast/notification queue
  toastQueue: Array<{
    id: string
    message: string
    type: 'success' | 'error' | 'info' | 'warning'
    duration?: number
  }>
  addToast: (toast: Omit<UIState['toastQueue'][0], 'id'>) => void
  removeToast: (id: string) => void
  
  // Keyboard shortcuts enabled
  keyboardShortcutsEnabled: boolean
  setKeyboardShortcutsEnabled: (enabled: boolean) => void
}

const defaultPreferences: UIPreferences = {
  sidebarCollapsed: false,
  showCompletedTasks: true,
  taskViewMode: 'board',
  boardDensity: 'comfortable',
  showTaskLabels: true,
  showTaskDueDates: true,
  showTaskAssignees: true,
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Sidebar
      isSidebarOpen: true,
      toggleSidebar: () => set((state) => ({ 
        isSidebarOpen: !state.isSidebarOpen 
      })),
      setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
      
      // Mobile menu
      isMobileMenuOpen: false,
      setMobileMenuOpen: (isOpen) => set({ isMobileMenuOpen: isOpen }),
      
      // Modal
      activeModal: null,
      modalData: {},
      openModal: (type, data = {}) => set({ 
        activeModal: type, 
        modalData: data 
      }),
      closeModal: () => set({ 
        activeModal: null, 
        modalData: {} 
      }),
      
      // Navigation
      isNavigating: false,
      setIsNavigating: (isNavigating) => set({ isNavigating }),
      
      // Preferences
      preferences: defaultPreferences,
      updatePreference: (key, value) => set((state) => ({
        preferences: {
          ...state.preferences,
          [key]: value,
        }
      })),
      resetPreferences: () => set({ 
        preferences: defaultPreferences 
      }),
      
      // Command palette
      isCommandPaletteOpen: false,
      setCommandPaletteOpen: (isOpen) => set({ 
        isCommandPaletteOpen: isOpen 
      }),
      
      // Toast queue
      toastQueue: [],
      addToast: (toast) => {
        const id = Math.random().toString(36).substring(7)
        set((state) => ({
          toastQueue: [...state.toastQueue, { ...toast, id }]
        }))
        
        // Auto-remove toast after duration
        if (toast.duration !== 0) {
          setTimeout(() => {
            get().removeToast(id)
          }, toast.duration || 5000)
        }
      },
      removeToast: (id) => set((state) => ({
        toastQueue: state.toastQueue.filter(t => t.id !== id)
      })),
      
      // Keyboard shortcuts
      keyboardShortcutsEnabled: true,
      setKeyboardShortcutsEnabled: (enabled) => set({ 
        keyboardShortcutsEnabled: enabled 
      }),
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist user preferences
        isSidebarOpen: state.isSidebarOpen,
        preferences: state.preferences,
        keyboardShortcutsEnabled: state.keyboardShortcutsEnabled,
        // Don't persist temporary UI states like modals, toasts, etc.
      }),
    }
  )
)

// Helper hook for modal management
export const useModal = (modalType: Exclude<ModalType, null>) => {
  const { activeModal, modalData, openModal, closeModal } = useUIStore()
  
  return {
    isOpen: activeModal === modalType,
    data: modalData,
    open: (data?: ModalData) => openModal(modalType, data),
    close: closeModal,
  }
}

// Helper hook for responsive sidebar
export const useResponsiveSidebar = () => {
  const { isSidebarOpen, setSidebarOpen, isMobileMenuOpen, setMobileMenuOpen } = useUIStore()
  
  const closeMobileMenu = () => setMobileMenuOpen(false)
  const openMobileMenu = () => setMobileMenuOpen(true)
  
  return {
    isSidebarOpen,
    setSidebarOpen,
    isMobileMenuOpen,
    closeMobileMenu,
    openMobileMenu,
  }
}
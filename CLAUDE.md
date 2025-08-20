# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a Next.js 15 SaaS starter template featuring a complete Kanban task management system with workspaces, integrated authentication (Clerk), real-time database (Convex), and subscription billing (Clerk Billing). Perfect for building collaborative project management tools, team productivity apps, or any SaaS requiring task organization and workspace management.

## Development Commands

### Core Development
- `npm run dev` - Start development server with Turbopack on http://localhost:3000
- `npm run build` - Build production bundle
- `npm start` - Start production server
- `npm run lint` - Run Next.js linting

### Convex Development
- `npx convex dev` - Start Convex development server (required for database)
- Run this in a separate terminal alongside `npm run dev`

## Architecture Overview

### Tech Stack
- **Next.js 15** with App Router and Turbopack
- **Convex** for real-time database and serverless functions
- **Clerk** for authentication and user management
- **Clerk Billing** for subscription payments
- **TailwindCSS v4** with custom UI components (shadcn/ui)
- **TypeScript** throughout
- **Zustand** for client-side state management
- **@dnd-kit** for drag-and-drop Kanban functionality
- **React Hook Form + Zod** for form handling and validation
- **Framer Motion** for animations
- **Recharts** for data visualization
- **date-fns** for date manipulation

### Key Architectural Patterns

#### Authentication Flow
1. Clerk handles all authentication via `middleware.ts`
2. JWT tokens are configured with "convex" template in Clerk dashboard
3. Users are synced to Convex via webhooks at `/api/clerk-users-webhook`
4. Protected routes redirect unauthenticated users to sign-in

#### Database Architecture
- **Convex** provides real-time sync and serverless functions
- Schema defined in `convex/schema.ts`:
  - `users` table: Synced from Clerk (externalId maps to Clerk ID)
  - `paymentAttempts` table: Tracks subscription payments
  - `workspaces` table: Team/project workspaces with settings
  - `workspaceMembers` table: User membership and roles (owner, admin, member, viewer)
  - `columns` table: Dynamic Kanban columns per workspace
  - `tasks` table: Task items with status, priority, assignments, and tags
  - `comments` table: Task comments with mentions
  - `invitations` table: Workspace invitation system
- All database operations in `convex/` directory

#### Payment Integration
1. Clerk Billing handles subscription management
2. Custom pricing component in `components/custom-clerk-pricing.tsx`
3. Payment-gated content uses `<ClerkBillingGate>` component
4. Webhook events update payment status in Convex

#### Workspace & Task Management
1. **Workspaces** provide team/project isolation
2. **Dynamic Kanban columns** customizable per workspace
3. **Drag-and-drop** task management using @dnd-kit
4. **Multiple views**: Kanban board, Calendar, and List
5. **Task features**: priorities, assignments, due dates, tags, comments
6. **Real-time collaboration** via Convex subscriptions

#### State Management
- **Zustand stores** for client-side state:
  - `workspace.store.ts`: Active workspace and selection
  - `theme.store.ts`: Theme preferences
  - `ui.store.ts`: UI state (sidebar, modals)
- **Workspace Provider** wraps dashboard for context access

### Project Structure
```
app/
├── (landing)/         # Public landing page components
├── dashboard/         # Protected dashboard area
│   ├── board/         # Kanban board view
│   ├── calendar/      # Calendar view with task visualization
│   ├── tasks/         # Tasks list view
│   ├── migrate/       # Data migration page
│   └── payment-gated/ # Subscription-only content
├── layout.tsx         # Root layout with providers
└── middleware.ts      # Auth protection

components/
├── ui/                # shadcn/ui components
├── kanban/            # Kanban board components
│   ├── kanban-board.tsx
│   ├── kanban-column.tsx
│   ├── kanban-card.tsx
│   ├── task-create-modal.tsx
│   └── task-edit-modal.tsx
├── providers/         # Context providers
│   └── workspace-provider.tsx
├── custom-clerk-pricing.tsx
├── ConvexClientProvider.tsx
├── TaskCreateDialog.tsx
├── TaskFilters.tsx
├── TaskStats.tsx
└── TasksTable.tsx

convex/
├── schema.ts          # Database schema
├── users.ts           # User CRUD operations
├── workspaces.ts      # Workspace management
├── workspaceMembers.ts # Membership operations
├── columns.ts         # Kanban columns
├── tasks.ts           # Task operations
├── paymentAttempts.ts # Payment tracking
├── http.ts            # Webhook handlers
└── auth.config.ts     # JWT configuration

lib/
├── stores/            # Zustand state management
│   ├── workspace.store.ts
│   ├── theme.store.ts
│   └── ui.store.ts
└── utils.ts           # Utility functions

hooks/
├── use-workspace.ts   # Workspace context hook
├── use-mobile.ts      # Mobile detection
└── use-toast.tsx      # Toast notifications
```

## Key Integration Points

### Environment Variables Required
- `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` (auto-generated by `npx convex dev`)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_FRONTEND_API_URL` (from Clerk JWT template)
- `CLERK_WEBHOOK_SECRET` (set in Convex dashboard, not in .env.local)
- `NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/dashboard`
- `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/dashboard`
- `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard`
- `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard`

### Webhook Configuration
Clerk webhooks must be configured to:
- Endpoint: `{your_domain}/api/clerk-users-webhook`
- Events: `user.created`, `user.updated`, `user.deleted`, `paymentAttempt.updated`

### Real-time Data Flow
1. UI components use Convex hooks (`useQuery`, `useMutation`)
2. Convex provides automatic real-time updates
3. Authentication context from `useAuth()` (Clerk)
4. User data synced between Clerk and Convex

## Shadcn Component Installation Rules
When installing shadcn/ui components:
- ALWAYS use `bunx --bun shadcn@latest add [component-name]` instead of `npx`
- If dependency installation fails, manually install with `bun install [dependency-name]`
- Check components.json for existing configuration before installing
- Verify package.json after installation to ensure dependencies were added
- Multiple components can be installed at once: `bunx --bun shadcn@latest add button card drawer`

## Key Features Documentation

### Kanban Board
- **Drag-and-drop** functionality powered by @dnd-kit
- **Dynamic columns** customizable per workspace
- **Task cards** display title, priority, assignees, due dates
- **Quick actions**: edit, delete, change status
- **Real-time updates** across all connected users

### Task Management
- **Priority levels**: Low, Medium, High, Urgent
- **Statuses**: Todo, In Progress, Review, Done
- **Assignments**: Multiple users per task
- **Tags**: Custom labels for organization
- **Comments**: With user mentions
- **Due dates**: With calendar integration
- **Archiving**: Soft delete for completed tasks

### Workspace System
- **Multi-workspace** support per user
- **Role-based access**: Owner, Admin, Member, Viewer
- **Invitation system** with email invites
- **Workspace settings**: Default view, timezone
- **Member management**: Add, remove, change roles

### Views
- **Kanban Board** (`/dashboard/board`): Drag-and-drop interface
- **Calendar** (`/dashboard/calendar`): Monthly view with tasks
- **Tasks List** (`/dashboard/tasks`): Table view with filtering
- **Dashboard** (`/dashboard`): Overview with stats and charts

## Development Tips

### Working with Convex
- Changes to schema require running `npx convex dev`
- Use `useQuery` and `useMutation` hooks for data operations
- Convex functions run server-side with automatic TypeScript validation
- Real-time subscriptions are automatic with `useQuery`

### Working with Workspaces
- Always check current workspace context using `useWorkspace()` hook
- Workspace ID is required for most database operations
- User permissions are enforced at the Convex function level

### Styling Guidelines
- Use Tailwind v4 syntax with CSS variables
- Follow shadcn/ui component patterns
- Dark mode support via `dark:` variant
- Use `cn()` utility for conditional classes

## Important Dependencies Note

The project uses **Bun** as the package manager. Key dependencies include:
- **@clerk/nextjs**: v6.24.0 - Authentication
- **convex**: v1.25.2 - Real-time database
- **@dnd-kit**: Core drag-and-drop functionality
- **zustand**: v5.0.7 - State management
- **react-hook-form**: v7.62.0 - Form handling
- **zod**: v4.0.16 - Schema validation
- **recharts**: v2.15.4 - Charts and data visualization
- **date-fns**: v4.1.0 - Date utilities
- **framer-motion**: v12.23.3 - Animations
- **@tabler/icons-react**: v3.34.0 - Icon library
- **tailwindcss**: v4 - Styling (using alpha version)

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle } from 'lucide-react'

export default function MigratePage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  
  const migrateWorkspaces = async () => {
    setStatus('running')
    setMessage('Running migration...')
    
    try {
      // Note: This is a temporary solution. In production, you would run this
      // migration through a server action or the Convex dashboard
      const response = await fetch('/api/run-migration', {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error('Migration failed')
      }
      
      setStatus('success')
      setMessage('Migration completed successfully! All workspaces now have columns.')
    } catch (error) {
      setStatus('error')
      setMessage('Migration failed. Please check the console for details.')
      console.error('Migration error:', error)
    }
  }
  
  return (
    <div className="flex-1 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Run Column Migration</h1>
          <p className="text-muted-foreground mt-2">
            This will create default columns for all existing workspaces and map tasks to the appropriate columns.
          </p>
        </div>
        
        {status === 'success' && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        
        {status === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        
        <div className="flex gap-4">
          <Button 
            onClick={migrateWorkspaces}
            disabled={status === 'running'}
          >
            {status === 'running' ? 'Running Migration...' : 'Run Migration'}
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => window.location.href = '/dashboard/board'}
          >
            Back to Board
          </Button>
        </div>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Note:</strong> For now, you can manually run the migration from the Convex dashboard:
            <br />
            <code className="text-sm bg-muted px-2 py-1 rounded mt-2 block">
              npx convex run migrations:migrateWorkspacesToColumns
            </code>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
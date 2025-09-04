'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, Filter, X, Users, Flag, CheckCircle2, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CalendarFiltersProps {
  onFiltersChange: (filters: FilterState) => void
  assignees?: any[]
  tags?: string[]
}

export interface FilterState {
  search: string
  priorities: string[]
  statuses: string[]
  assigneeIds: string[]
  tags: string[]
  showCompleted: boolean
}

const priorityOptions = [
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500/10 text-red-600 hover:bg-red-500/20' },
  { value: 'high', label: 'High', color: 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/20' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20' },
  { value: 'low', label: 'Low', color: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20' },
]

const statusOptions = [
  { value: 'todo', label: 'To Do', color: 'bg-gray-500/10 text-gray-600 hover:bg-gray-500/20' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20' },
  { value: 'review', label: 'Review', color: 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20' },
  { value: 'done', label: 'Done', color: 'bg-green-500/10 text-green-600 hover:bg-green-500/20' },
]

function CalendarFiltersComponent({ onFiltersChange, assignees = [], tags = [] }: CalendarFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    priorities: [],
    statuses: [],
    assigneeIds: [],
    tags: [],
    showCompleted: true,
  })

  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    onFiltersChange(filters)
  }, [filters, onFiltersChange])

  const handleSearchChange = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, search: value }))
  }, [])

  const togglePriority = useCallback((priority: string) => {
    setFilters(prev => ({
      ...prev,
      priorities: prev.priorities.includes(priority)
        ? prev.priorities.filter(p => p !== priority)
        : [...prev.priorities, priority]
    }))
  }, [])

  const toggleStatus = useCallback((status: string) => {
    setFilters(prev => ({
      ...prev,
      statuses: prev.statuses.includes(status)
        ? prev.statuses.filter(s => s !== status)
        : [...prev.statuses, status]
    }))
  }, [])

  const toggleAssignee = useCallback((assigneeId: string) => {
    setFilters(prev => ({
      ...prev,
      assigneeIds: prev.assigneeIds.includes(assigneeId)
        ? prev.assigneeIds.filter(id => id !== assigneeId)
        : [...prev.assigneeIds, assigneeId]
    }))
  }, [])

  const toggleTag = useCallback((tag: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      priorities: [],
      statuses: [],
      assigneeIds: [],
      tags: [],
      showCompleted: true,
    })
  }, [])

  const activeFilterCount = 
    filters.priorities.length + 
    filters.statuses.length + 
    filters.assigneeIds.length + 
    filters.tags.length +
    (filters.search ? 1 : 0) +
    (!filters.showCompleted ? 1 : 0)

  return (
    <div className="space-y-3 p-4 bg-card/50 backdrop-blur-sm rounded-lg border border-border/50">
      {/* Search and Quick Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-9"
          />
          {filters.search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => handleSearchChange('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <Button
          variant={isExpanded ? "secondary" : "outline"}
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="relative"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <Badge className="ml-2 h-5 px-1.5 text-[10px]" variant="secondary">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="space-y-3 animate-in slide-in-from-top duration-200">
          {/* Priority Filter */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Flag className="h-3 w-3" />
              Priority
            </label>
            <div className="flex flex-wrap gap-1">
              {priorityOptions.map(option => (
                <Button
                  key={option.value}
                  variant="outline"
                  size="sm"
                  onClick={() => togglePriority(option.value)}
                  className={cn(
                    "h-7 px-2 text-xs transition-all",
                    filters.priorities.includes(option.value) && option.color
                  )}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Status
            </label>
            <div className="flex flex-wrap gap-1">
              {statusOptions.map(option => (
                <Button
                  key={option.value}
                  variant="outline"
                  size="sm"
                  onClick={() => toggleStatus(option.value)}
                  className={cn(
                    "h-7 px-2 text-xs transition-all",
                    filters.statuses.includes(option.value) && option.color
                  )}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Assignee Filter */}
          {assignees.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                Assignees
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7">
                    {filters.assigneeIds.length > 0
                      ? `${filters.assigneeIds.length} selected`
                      : 'Select assignees'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Filter by assignee</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {assignees.map(assignee => (
                    <DropdownMenuCheckboxItem
                      key={assignee._id}
                      checked={filters.assigneeIds.includes(assignee._id)}
                      onCheckedChange={() => toggleAssignee(assignee._id)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                          {assignee.name.charAt(0).toUpperCase()}
                        </div>
                        {assignee.name}
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Tags Filter */}
          {tags.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Tags
              </label>
              <div className="flex flex-wrap gap-1">
                {tags.map(tag => (
                  <Button
                    key={tag}
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "h-7 px-2 text-xs transition-all",
                      filters.tags.includes(tag) && "bg-primary/10 text-primary border-primary/30"
                    )}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Show Completed Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Show completed tasks
            </label>
            <Button
              variant={filters.showCompleted ? "default" : "outline"}
              size="sm"
              onClick={() => setFilters(prev => ({ ...prev, showCompleted: !prev.showCompleted }))}
              className="h-7 px-3"
            >
              {filters.showCompleted ? 'Showing' : 'Hidden'}
            </Button>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {activeFilterCount > 0 && !isExpanded && (
        <div className="flex flex-wrap gap-1">
          {filters.search && (
            <Badge variant="secondary" className="text-xs">
              Search: {filters.search}
            </Badge>
          )}
          {filters.priorities.map(priority => (
            <Badge key={priority} variant="secondary" className="text-xs">
              {priority}
            </Badge>
          ))}
          {filters.statuses.map(status => (
            <Badge key={status} variant="secondary" className="text-xs">
              {status}
            </Badge>
          ))}
          {filters.assigneeIds.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {filters.assigneeIds.length} assignee(s)
            </Badge>
          )}
          {filters.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              #{tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export const CalendarFilters = memo(CalendarFiltersComponent)
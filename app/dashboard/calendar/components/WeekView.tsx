'use client'

import { useMemo, memo } from 'react'
import { format, startOfWeek, addDays, isToday, isSameDay, addHours, startOfDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TaskCard } from './TaskCard'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface WeekViewProps {
  currentDate: Date
  tasksByDate: Map<string, any[]>
  selectedDate: Date | null
  onDateClick: (date: Date) => void
  onCreateTask: (date: string) => void
}

interface DayColumnProps {
  date: Date
  dateKey: string
  tasks: any[]
  isSelected: boolean
  isToday: boolean
  onDateClick: () => void
  onCreateTask: () => void
  timeSlots: Date[]
}

function DayColumn({
  date,
  dateKey,
  tasks,
  isSelected,
  isToday,
  onDateClick,
  onCreateTask,
  timeSlots,
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
  })

  const taskIds = tasks.map(task => task._id)
  const dayName = format(date, 'EEE')
  const dayNumber = format(date, 'd')
  const monthName = format(date, 'MMM')

  // Group tasks by hour (if they have time information)
  const tasksByHour = useMemo(() => {
    const hourMap = new Map<number, any[]>()
    
    tasks.forEach(task => {
      // For now, distribute tasks throughout the day
      // In a real implementation, you'd parse time from task data
      const hour = Math.floor(Math.random() * 9) + 9 // 9am-6pm
      const existing = hourMap.get(hour) || []
      hourMap.set(hour, [...existing, task])
    })
    
    return hourMap
  }, [tasks])

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 min-w-[140px] flex flex-col h-full',
        isOver && 'bg-primary/5'
      )}
    >
      {/* Day Header */}
      <div
        className={cn(
          'sticky top-0 z-20 bg-background/95 backdrop-blur-sm p-3 text-center cursor-pointer',
          'border-b border-border/10 transition-colors',
          'hover:bg-accent/50',
          isSelected && 'bg-accent',
          isToday && 'bg-primary/10'
        )}
        onClick={onDateClick}
      >
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">{dayName}</p>
          <p className={cn(
            'text-lg font-bold',
            isToday && 'text-primary'
          )}>
            {dayNumber}
          </p>
          <p className="text-[10px] text-muted-foreground">{monthName}</p>
        </div>
        {tasks.length > 0 && (
          <div className={cn(
            'mt-2 text-xs px-2 py-0.5 rounded-full',
            'bg-muted text-muted-foreground font-medium'
          )}>
            {tasks.length} tasks
          </div>
        )}
      </div>

      {/* Time Slots */}
      <div className="flex-1 relative">
        {/* All day section */}
        <div className="border-b border-border/10 p-2 min-h-[60px] bg-muted/20">
          <div className="text-[10px] text-muted-foreground font-medium mb-1">All Day</div>
          <SortableContext
            items={taskIds.slice(0, 2)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {tasks.slice(0, 2).map((task) => (
                <TaskCard key={task._id} task={task} />
              ))}
            </div>
          </SortableContext>
        </div>

        {/* Hourly slots */}
        <ScrollArea className="h-[600px]">
          <div className="relative">
            {timeSlots.map((slot, index) => {
              const hour = slot.getHours()
              const tasksInHour = tasksByHour.get(hour) || []
              
              return (
                <div
                  key={index}
                  className={cn(
                    'h-16 border-b border-border/5 relative group',
                    'hover:bg-muted/10 transition-colors'
                  )}
                >
                  {/* Tasks in this hour */}
                  {tasksInHour.length > 0 && (
                    <div className="absolute inset-x-1 top-1 space-y-1">
                      <SortableContext
                        items={tasksInHour.map(t => t._id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {tasksInHour.map((task) => (
                          <TaskCard key={task._id} task={task} />
                        ))}
                      </SortableContext>
                    </div>
                  )}
                  
                  {/* Add task button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      onCreateTask()
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

function WeekViewComponent({
  currentDate,
  tasksByDate,
  selectedDate,
  onDateClick,
  onCreateTask,
}: WeekViewProps) {
  // Generate week days
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [currentDate])

  // Generate time slots (hourly from 6am to 11pm)
  const timeSlots = useMemo(() => {
    const dayStart = startOfDay(new Date())
    return Array.from({ length: 18 }, (_, i) => addHours(dayStart, i + 6))
  }, [])

  return (
    <div className="bg-card/50 backdrop-blur-sm rounded-xl shadow-sm overflow-hidden h-[800px] flex flex-col">
      {/* Time Labels */}
      <div className="flex">
        <div className="w-16 sticky left-0 z-30 bg-background/95 backdrop-blur-sm">
          <div className="h-[140px] border-b border-border/10" />
          <div className="h-[60px] border-b border-border/10 flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground">All Day</span>
          </div>
          <ScrollArea className="h-[600px]">
            {timeSlots.map((slot, index) => (
              <div
                key={index}
                className="h-16 border-b border-border/5 flex items-center justify-center"
              >
                <span className="text-xs text-muted-foreground">
                  {format(slot, 'ha')}
                </span>
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* Day Columns */}
        <div className="flex-1 flex overflow-x-auto">
          {weekDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const tasks = tasksByDate.get(dateKey) || []
            
            return (
              <DayColumn
                key={dateKey}
                date={day}
                dateKey={dateKey}
                tasks={tasks}
                isSelected={selectedDate ? isSameDay(day, selectedDate) : false}
                isToday={isToday(day)}
                onDateClick={() => onDateClick(day)}
                onCreateTask={() => onCreateTask(dateKey)}
                timeSlots={timeSlots}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

export const WeekView = memo(WeekViewComponent)
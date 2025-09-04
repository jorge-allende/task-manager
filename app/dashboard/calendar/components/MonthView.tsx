'use client'

import { useMemo, memo } from 'react'
import { format, startOfWeek, addDays, isSameMonth, isToday, isSameDay } from 'date-fns'
import { DayCell } from './DayCell'
import { cn } from '@/lib/utils'

interface MonthViewProps {
  currentDate: Date
  tasksByDate: Map<string, any[]>
  selectedDate: Date | null
  onDateClick: (date: Date) => void
  onCreateTask: (date: string) => void
  startDate: Date
  endDate: Date
}

function MonthViewComponent({
  currentDate,
  tasksByDate,
  selectedDate,
  onDateClick,
  onCreateTask,
  startDate,
  endDate,
}: MonthViewProps) {
  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const days: Date[] = []
    let day = startDate
    
    while (day <= endDate) {
      days.push(day)
      day = addDays(day, 1)
    }
    
    return days
  }, [startDate, endDate])

  // Weekday headers
  const weekDays = useMemo(() => {
    const firstDayOfWeek = startOfWeek(new Date())
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(firstDayOfWeek, i)
      return format(day, 'EEE')
    })
  }, [])

  return (
    <div className="bg-card/50 backdrop-blur-sm rounded-xl shadow-sm overflow-hidden">
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 bg-muted/30 backdrop-blur-sm">
        {weekDays.map((day, index) => {
          const isWeekend = index === 0 || index === 6
          return (
            <div
              key={day}
              className={cn(
                "py-4 text-center text-sm font-semibold transition-colors",
                isWeekend ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {day}
            </div>
          )
        })}
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-border/5 p-px">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const tasks = tasksByDate.get(dateKey) || []
          const isCurrentMonth = isSameMonth(day, currentDate)
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
          const today = isToday(day)
          
          return (
            <DayCell
              key={dateKey}
              date={day}
              dateKey={dateKey}
              tasks={tasks}
              isCurrentMonth={isCurrentMonth}
              isSelected={isSelected}
              isToday={today}
              onClick={() => onDateClick(day)}
              onCreateTask={() => onCreateTask(dateKey)}
            />
          )
        })}
      </div>
    </div>
  )
}

export const MonthView = memo(MonthViewComponent)
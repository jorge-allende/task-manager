'use client'

import { useMemo } from 'react'
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

export function MonthView({
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
    <div className="bg-background rounded-lg border">
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-3 text-center text-sm font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
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
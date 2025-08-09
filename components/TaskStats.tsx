"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  TrendingUp,
  Calendar,
  Target,
  Activity,
  Timer
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskStats {
  total: number;
  byStatus: {
    todo: number;
    in_progress: number;
    review: number;
    done: number;
  };
  byPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  completedThisWeek: number;
  averageCompletionTime: number;
}

interface TaskStatsProps {
  stats: TaskStats;
}

export function TaskStats({ stats }: TaskStatsProps) {
  const completionRate = stats.total > 0 
    ? Math.round((stats.byStatus.done / stats.total) * 100) 
    : 0;
    
  const inProgressRate = stats.total > 0
    ? Math.round(((stats.byStatus.in_progress + stats.byStatus.review) / stats.total) * 100)
    : 0;

  const statsCards = [
    {
      title: "Total Tasks",
      value: stats.total,
      description: `${stats.byStatus.done} completed`,
      icon: Target,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Completion Rate",
      value: `${completionRate}%`,
      description: "Tasks completed",
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-100",
      progress: completionRate,
    },
    {
      title: "In Progress",
      value: stats.byStatus.in_progress + stats.byStatus.review,
      description: `${inProgressRate}% of total`,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      title: "Overdue",
      value: stats.overdue,
      description: stats.overdue > 0 ? "Need attention" : "All on track",
      icon: AlertCircle,
      color: stats.overdue > 0 ? "text-red-600" : "text-gray-600",
      bgColor: stats.overdue > 0 ? "bg-red-100" : "bg-gray-100",
    },
  ];

  const additionalStats = [
    {
      label: "Due Today",
      value: stats.dueToday,
      icon: Calendar,
      color: "text-orange-600",
    },
    {
      label: "Due This Week",
      value: stats.dueThisWeek,
      icon: TrendingUp,
      color: "text-purple-600",
    },
    {
      label: "Completed This Week",
      value: stats.completedThisWeek,
      icon: Activity,
      color: "text-green-600",
    },
    {
      label: "Avg. Completion Time",
      value: `${stats.averageCompletionTime}d`,
      icon: Timer,
      color: "text-blue-600",
    },
  ];

  const priorityDistribution = [
    { label: "Urgent", value: stats.byPriority.urgent, color: "bg-red-500" },
    { label: "High", value: stats.byPriority.high, color: "bg-orange-500" },
    { label: "Medium", value: stats.byPriority.medium, color: "bg-blue-500" },
    { label: "Low", value: stats.byPriority.low, color: "bg-gray-400" },
  ];

  const totalPriorityTasks = Object.values(stats.byPriority).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* Main Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={cn("rounded-full p-2", stat.bgColor)}>
                <stat.icon className={cn("h-4 w-4", stat.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
              {stat.progress !== undefined && (
                <Progress value={stat.progress} className="mt-2 h-1" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Stats and Priority Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Additional Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {additionalStats.map((stat, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <stat.icon className={cn("h-4 w-4", stat.color)} />
                  <span className="text-sm text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
                <span className="text-sm font-medium">{stat.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Priority Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {priorityDistribution.map((priority, index) => {
                const percentage = totalPriorityTasks > 0 
                  ? Math.round((priority.value / totalPriorityTasks) * 100)
                  : 0;
                
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{priority.label}</span>
                      <span className="text-muted-foreground">
                        {priority.value} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full transition-all", priority.color)}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
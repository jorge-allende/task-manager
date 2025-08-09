"use client";

import { useState, useMemo } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { 
  MoreHorizontal, 
  ArrowUpIcon, 
  ArrowDownIcon,
  CalendarIcon,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Task {
  _id: Id<"tasks">;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assignees?: Array<{ _id: Id<"users">; name: string }>;
  creator?: { _id: Id<"users">; name: string };
  dueDate?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface TasksTableProps {
  tasks: Task[];
  selectedTaskIds: Set<Id<"tasks">>;
  onSelectionChange: (taskId: Id<"tasks">, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  isLoading?: boolean;
}

const priorityConfig = {
  low: { label: "Low", color: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
  medium: { label: "Medium", color: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
  high: { label: "High", color: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700 hover:bg-red-200" },
};

const statusConfig = {
  todo: { label: "To Do", icon: Circle, color: "text-gray-500" },
  in_progress: { label: "In Progress", icon: Clock, color: "text-blue-500" },
  review: { label: "Review", icon: AlertCircle, color: "text-yellow-500" },
  done: { label: "Done", icon: CheckCircle2, color: "text-green-500" },
};

export function TasksTable({
  tasks,
  selectedTaskIds,
  onSelectionChange,
  onSelectAll,
  isLoading = false,
}: TasksTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null);

  const updateTask = useMutation(api.tasks.update);
  const archiveTask = useMutation(api.tasks.archive);

  const handleInlineEdit = async (taskId: Id<"tasks">, field: string, value: any) => {
    try {
      await updateTask({
        id: taskId,
        [field]: value,
      });
      toast.success("Task updated");
      setEditingCell(null);
    } catch (error) {
      toast.error("Failed to update task");
      console.error(error);
    }
  };

  const columns: ColumnDef<Task>[] = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => {
              table.toggleAllPageRowsSelected(!!value);
              onSelectAll(!!value);
            }}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedTaskIds.has(row.original._id)}
            onCheckedChange={(value) => {
              row.toggleSelected(!!value);
              onSelectionChange(row.original._id, !!value);
            }}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "title",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Title
              {column.getIsSorted() === "asc" ? (
                <ArrowUpIcon className="ml-2 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDownIcon className="ml-2 h-4 w-4" />
              ) : null}
            </Button>
          );
        },
        cell: ({ row }) => {
          const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === "title";
          const [editValue, setEditValue] = useState(row.original.title);

          if (isEditing) {
            return (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleInlineEdit(row.original._id, "title", editValue)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleInlineEdit(row.original._id, "title", editValue);
                  } else if (e.key === "Escape") {
                    setEditingCell(null);
                  }
                }}
                className="max-w-[300px]"
                autoFocus
              />
            );
          }

          return (
            <div
              className="font-medium cursor-pointer hover:underline"
              onClick={() => setEditingCell({ rowId: row.id, columnId: "title" })}
            >
              {row.original.title}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Status
              {column.getIsSorted() === "asc" ? (
                <ArrowUpIcon className="ml-2 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDownIcon className="ml-2 h-4 w-4" />
              ) : null}
            </Button>
          );
        },
        cell: ({ row }) => {
          const status = row.original.status;
          const StatusIcon = statusConfig[status].icon;
          const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === "status";

          if (isEditing) {
            return (
              <Select
                defaultValue={status}
                onValueChange={(value) => {
                  handleInlineEdit(row.original._id, "status", value);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className={cn("h-4 w-4", config.color)} />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          }

          return (
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setEditingCell({ rowId: row.id, columnId: "status" })}
            >
              <StatusIcon className={cn("h-4 w-4", statusConfig[status].color)} />
              <span className="text-sm">{statusConfig[status].label}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "priority",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Priority
              {column.getIsSorted() === "asc" ? (
                <ArrowUpIcon className="ml-2 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDownIcon className="ml-2 h-4 w-4" />
              ) : null}
            </Button>
          );
        },
        cell: ({ row }) => {
          const priority = row.original.priority;
          const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === "priority";

          if (isEditing) {
            return (
              <Select
                defaultValue={priority}
                onValueChange={(value) => {
                  handleInlineEdit(row.original._id, "priority", value);
                }}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          }

          return (
            <Badge
              className={cn(
                "cursor-pointer",
                priorityConfig[priority].color
              )}
              onClick={() => setEditingCell({ rowId: row.id, columnId: "priority" })}
            >
              {priorityConfig[priority].label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "assignees",
        header: "Assignee",
        cell: ({ row }) => {
          const assignees = row.original.assignees || [];
          
          if (assignees.length === 0) {
            return <span className="text-muted-foreground">Unassigned</span>;
          }

          return (
            <div className="flex -space-x-2">
              {assignees.slice(0, 3).map((assignee) => (
                <Avatar key={assignee._id} className="h-8 w-8 border-2 border-background">
                  <AvatarFallback>{assignee.name[0]}</AvatarFallback>
                </Avatar>
              ))}
              {assignees.length > 3 && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs">
                  +{assignees.length - 3}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "dueDate",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Due Date
              {column.getIsSorted() === "asc" ? (
                <ArrowUpIcon className="ml-2 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDownIcon className="ml-2 h-4 w-4" />
              ) : null}
            </Button>
          );
        },
        cell: ({ row }) => {
          const dueDate = row.original.dueDate;
          const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === "dueDate";

          if (isEditing) {
            return (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(new Date(dueDate), "MMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate ? new Date(dueDate) : undefined}
                    onSelect={(date) => {
                      handleInlineEdit(
                        row.original._id,
                        "dueDate",
                        date ? date.toISOString() : undefined
                      );
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            );
          }

          if (!dueDate) {
            return (
              <span
                className="text-muted-foreground cursor-pointer"
                onClick={() => setEditingCell({ rowId: row.id, columnId: "dueDate" })}
              >
                No due date
              </span>
            );
          }

          const date = new Date(dueDate);
          const isOverdue = date < new Date() && row.original.status !== "done";

          return (
            <div
              className={cn(
                "text-sm cursor-pointer",
                isOverdue && "text-red-600 font-medium"
              )}
              onClick={() => setEditingCell({ rowId: row.id, columnId: "dueDate" })}
            >
              {format(date, "MMM d, yyyy")}
            </div>
          );
        },
      },
      {
        accessorKey: "tags",
        header: "Tags",
        cell: ({ row }) => {
          const tags = row.original.tags || [];
          
          if (tags.length === 0) {
            return null;
          }

          return (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {tags.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{tags.length - 2}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const task = row.original;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(task._id)}
                >
                  Copy task ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>View details</DropdownMenuItem>
                <DropdownMenuItem>Edit task</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      await archiveTask({ id: task._id });
                      toast.success("Task archived");
                    } catch (error) {
                      toast.error("Failed to archive task");
                    }
                  }}
                  className="text-red-600"
                >
                  Archive task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [selectedTaskIds, editingCell, updateTask, archiveTask, onSelectionChange, onSelectAll]
  );

  const table = useReactTable({
    data: tasks,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="w-full">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
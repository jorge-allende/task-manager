"use client";

import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Search, X, Filter, Check } from "lucide-react";

interface TaskFiltersProps {
  statusFilter?: string;
  priorityFilter?: string;
  assigneeFilter?: Id<"users">;
  tagsFilter: string[];
  searchQuery: string;
  members: Array<{
    user: {
      _id: Id<"users">;
      name: string;
    };
    role: string;
  }>;
  onStatusChange: (status: string | undefined) => void;
  onPriorityChange: (priority: string | undefined) => void;
  onAssigneeChange: (assignee: Id<"users"> | undefined) => void;
  onTagsChange: (tags: string[]) => void;
  onSearchChange: (search: string) => void;
}

const statusOptions = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const commonTags = [
  "bug",
  "feature",
  "enhancement",
  "documentation",
  "testing",
  "design",
  "backend",
  "frontend",
  "api",
  "database",
];

export function TaskFilters({
  statusFilter,
  priorityFilter,
  assigneeFilter,
  tagsFilter,
  searchQuery,
  members,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onTagsChange,
  onSearchChange,
}: TaskFiltersProps) {
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  
  const hasActiveFilters = statusFilter || priorityFilter || assigneeFilter || tagsFilter.length > 0;
  
  const clearAllFilters = () => {
    onStatusChange(undefined);
    onPriorityChange(undefined);
    onAssigneeChange(undefined);
    onTagsChange([]);
    onSearchChange("");
  };
  
  const toggleTag = (tag: string) => {
    if (tagsFilter.includes(tag)) {
      onTagsChange(tagsFilter.filter(t => t !== tag));
    } else {
      onTagsChange([...tagsFilter, tag]);
    }
  };
  
  const addCustomTag = () => {
    if (tagInput && !tagsFilter.includes(tagInput)) {
      onTagsChange([...tagsFilter, tagInput]);
      setTagInput("");
    }
  };
  
  const selectedMember = members.find(m => m.user._id === assigneeFilter);
  
  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-muted-foreground"
          >
            Clear filters
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      
      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        
        {/* Status Filter */}
        <Select value={statusFilter || ""} onValueChange={(value) => onStatusChange(value || undefined)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Status</SelectItem>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Priority Filter */}
        <Select value={priorityFilter || ""} onValueChange={(value) => onPriorityChange(value || undefined)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Priority</SelectItem>
            {priorityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Assignee Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-[200px] justify-between"
            >
              {selectedMember ? (
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-xs">
                      {selectedMember.user.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{selectedMember.user.name}</span>
                </div>
              ) : (
                "Assignee"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0">
            <Command>
              <CommandInput placeholder="Search members..." />
              <CommandEmpty>No member found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => onAssigneeChange(undefined)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !assigneeFilter ? "opacity-100" : "opacity-0"
                    )}
                  />
                  All Members
                </CommandItem>
                {members.map((member) => (
                  <CommandItem
                    key={member.user._id}
                    onSelect={() => onAssigneeChange(member.user._id)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        assigneeFilter === member.user._id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-xs">
                          {member.user.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span>{member.user.name}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
        
        {/* Tags Filter */}
        <Popover open={isTagsOpen} onOpenChange={setIsTagsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={isTagsOpen}
              className="justify-between"
            >
              {tagsFilter.length > 0 ? (
                <span>{tagsFilter.length} tags selected</span>
              ) : (
                "Tags"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-4">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomTag();
                    }
                  }}
                />
                <Button size="sm" onClick={addCustomTag}>
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Common tags</p>
                <div className="flex flex-wrap gap-2">
                  {commonTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={tagsFilter.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                      {tagsFilter.includes(tag) && (
                        <X className="ml-1 h-3 w-3" />
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
              {tagsFilter.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Selected tags</p>
                  <div className="flex flex-wrap gap-2">
                    {tagsFilter
                      .filter(tag => !commonTags.includes(tag))
                      .map((tag) => (
                        <Badge
                          key={tag}
                          variant="default"
                          className="cursor-pointer"
                          onClick={() => toggleTag(tag)}
                        >
                          {tag}
                          <X className="ml-1 h-3 w-3" />
                        </Badge>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      {/* Active Filters Display */}
      {(statusFilter || priorityFilter || assigneeFilter || tagsFilter.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {statusFilter && (
            <Badge variant="secondary">
              Status: {statusOptions.find(s => s.value === statusFilter)?.label}
              <X
                className="ml-1 h-3 w-3 cursor-pointer"
                onClick={() => onStatusChange(undefined)}
              />
            </Badge>
          )}
          {priorityFilter && (
            <Badge variant="secondary">
              Priority: {priorityOptions.find(p => p.value === priorityFilter)?.label}
              <X
                className="ml-1 h-3 w-3 cursor-pointer"
                onClick={() => onPriorityChange(undefined)}
              />
            </Badge>
          )}
          {selectedMember && (
            <Badge variant="secondary">
              Assignee: {selectedMember.user.name}
              <X
                className="ml-1 h-3 w-3 cursor-pointer"
                onClick={() => onAssigneeChange(undefined)}
              />
            </Badge>
          )}
          {tagsFilter.map((tag) => (
            <Badge key={tag} variant="secondary">
              Tag: {tag}
              <X
                className="ml-1 h-3 w-3 cursor-pointer"
                onClick={() => toggleTag(tag)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
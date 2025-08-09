"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { 
  Trash2, 
  Archive, 
  CheckCircle, 
  Users, 
  Tag, 
  AlertCircle,
  Check,
  ChevronsUpDown
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkActionsProps {
  selectedTaskIds: Id<"tasks">[];
  workspaceId: Id<"workspaces">;
  onComplete: () => void;
}

export function BulkActions({ selectedTaskIds, workspaceId, onComplete }: BulkActionsProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<Id<"users">[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const bulkUpdate = useMutation(api.tasks.bulkUpdate);
  const bulkArchive = useMutation(api.tasks.bulkArchive);
  
  const members = useQuery(api.workspaceMembers.list, { 
    workspaceId,
    paginationOpts: { numItems: 100, cursor: null }
  });

  const handleBulkUpdate = async (updates: any) => {
    try {
      const result = await bulkUpdate({
        taskIds: selectedTaskIds,
        updates,
      });
      toast.success(`Updated ${result.updated} tasks`);
      onComplete();
    } catch (error) {
      toast.error("Failed to update tasks");
      console.error(error);
    }
  };

  const handleBulkArchive = async () => {
    try {
      const result = await bulkArchive({
        taskIds: selectedTaskIds,
      });
      toast.success(`Archived ${result.archived} tasks`);
      setIsDeleteOpen(false);
      onComplete();
    } catch (error) {
      toast.error("Failed to archive tasks");
      console.error(error);
    }
  };

  const handleAssignUsers = async () => {
    if (selectedAssignees.length === 0) {
      toast.error("Please select at least one assignee");
      return;
    }
    
    await handleBulkUpdate({ assignedTo: selectedAssignees });
    setIsAssignOpen(false);
    setSelectedAssignees([]);
  };

  const handleAddTags = async () => {
    if (selectedTags.length === 0) {
      toast.error("Please add at least one tag");
      return;
    }
    
    await handleBulkUpdate({ tags: selectedTags });
    setIsUpdateOpen(false);
    setSelectedTags([]);
  };

  const toggleAssignee = (userId: Id<"users">) => {
    setSelectedAssignees(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const addTag = () => {
    if (tagInput && !selectedTags.includes(tagInput)) {
      setSelectedTags([...selectedTags, tagInput]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
      <div className="flex items-center gap-2 px-2">
        <CheckCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {selectedTaskIds.length} task{selectedTaskIds.length !== 1 ? "s" : ""} selected
        </span>
      </div>
      
      <div className="h-4 w-px bg-border" />
      
      <div className="flex items-center gap-1">
        {/* Update Status */}
        <Select
          onValueChange={(value) => handleBulkUpdate({ status: value })}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Update status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>

        {/* Update Priority */}
        <Select
          onValueChange={(value) => handleBulkUpdate({ priority: value })}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Update priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>

        {/* Assign Users */}
        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Users className="mr-2 h-4 w-4" />
              Assign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign tasks to members</DialogTitle>
              <DialogDescription>
                Select team members to assign to the selected tasks.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Command>
                <CommandInput placeholder="Search members..." />
                <CommandEmpty>No member found.</CommandEmpty>
                <CommandGroup>
                  {members?.page.filter(m => m.user).map((member) => (
                    <CommandItem
                      key={member.user!._id}
                      onSelect={() => toggleAssignee(member.user!._id)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Check
                          className={cn(
                            "h-4 w-4",
                            selectedAssignees.includes(member.user!._id)
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {member.user!.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm">{member.user!.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {member.role}
                          </span>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
              {selectedAssignees.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Selected:</span>
                  {selectedAssignees.map((userId) => {
                    const member = members?.page.find(m => m.user?._id === userId);
                    return member ? (
                      <Badge key={userId} variant="secondary">
                        {member.user!.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignUsers}>
                Assign to {selectedAssignees.length} member{selectedAssignees.length !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Tags */}
        <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Tag className="mr-2 h-4 w-4" />
              Tags
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update tags</DialogTitle>
              <DialogDescription>
                Add or update tags for the selected tasks.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
                <Button size="sm" onClick={addTag}>
                  Add
                </Button>
              </div>
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm font-medium">Suggested tags</p>
                <div className="flex flex-wrap gap-2">
                  {["bug", "feature", "enhancement", "urgent", "blocked"].map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => {
                        if (!selectedTags.includes(tag)) {
                          setSelectedTags([...selectedTags, tag]);
                        }
                      }}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUpdateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddTags}>
                Update tags
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="h-4 w-px bg-border" />

        {/* Archive Tasks */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-destructive hover:text-destructive">
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archive tasks</DialogTitle>
              <DialogDescription>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>This action will archive {selectedTaskIds.length} task{selectedTaskIds.length !== 1 ? "s" : ""}.</span>
                  </div>
                  <p>Archived tasks can be restored from the archive view.</p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleBulkArchive}>
                Archive {selectedTaskIds.length} task{selectedTaskIds.length !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
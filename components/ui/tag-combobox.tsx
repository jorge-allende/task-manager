"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { getTagColor } from "@/components/kanban/kanban-card"
import { Doc, Id } from "@/convex/_generated/dataModel"

interface Tag {
  _id: Id<"workspaceTags">
  name: string
  color: string
}

interface TagComboboxProps {
  value: string[]
  onChange: (value: string[]) => void
  tags: Tag[]
  placeholder?: string
  disabled?: boolean
  onCreateTag?: (name: string) => void
  className?: string
}

export function TagCombobox({
  value = [],
  onChange,
  tags,
  placeholder = "Select tags...",
  disabled = false,
  onCreateTag,
  className,
}: TagComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const selectedTags = React.useMemo(() => {
    return value.map((tagName) => {
      const tag = tags.find((t) => t.name === tagName)
      return {
        name: tagName,
        color: tag?.color,
      }
    })
  }, [value, tags])

  const availableTags = React.useMemo(() => {
    return tags.filter((tag) => !value.includes(tag.name))
  }, [tags, value])

  const filteredTags = React.useMemo(() => {
    if (!searchValue) return availableTags
    
    const lowerSearch = searchValue.toLowerCase()
    return availableTags.filter((tag) =>
      tag.name.toLowerCase().includes(lowerSearch)
    )
  }, [availableTags, searchValue])

  const handleSelect = (tagName: string) => {
    if (value.includes(tagName)) {
      onChange(value.filter((v) => v !== tagName))
    } else {
      onChange([...value, tagName])
    }
  }

  const handleRemove = (tagName: string) => {
    onChange(value.filter((v) => v !== tagName))
  }

  const canCreateTag = React.useMemo(() => {
    if (!searchValue.trim() || !onCreateTag) return false
    
    // Check if a tag with this name already exists
    const exists = tags.some(
      (tag) => tag.name.toLowerCase() === searchValue.trim().toLowerCase()
    )
    
    return !exists
  }, [searchValue, tags, onCreateTag])

  return (
    <div className={cn("w-full space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select tags"
            disabled={disabled}
            className={cn(
              "w-full justify-between",
              !value.length && "text-muted-foreground"
            )}
          >
            <span className="truncate">
              {value.length > 0
                ? `${value.length} tag${value.length > 1 ? "s" : ""} selected`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search tags..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                {canCreateTag ? (
                  <div className="py-2">
                    <p className="text-sm text-muted-foreground mb-2">
                      No tag found.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        onCreateTag?.(searchValue.trim())
                        setSearchValue("")
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create "{searchValue.trim()}"
                    </Button>
                  </div>
                ) : (
                  "No tags found."
                )}
              </CommandEmpty>
              
              {filteredTags.length > 0 && (
                <CommandGroup>
                  {filteredTags.map((tag) => {
                    const { bg, text } = getTagColor(tag.name, tag.color)
                    const isSelected = value.includes(tag.name)
                    
                    return (
                      <CommandItem
                        key={tag._id}
                        value={tag.name}
                        onSelect={() => handleSelect(tag.name)}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <Badge className={cn(bg, text, "pointer-events-none")}>
                          {tag.name}
                        </Badge>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )}
              
              {canCreateTag && filteredTags.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value={searchValue}
                      onSelect={() => {
                        onCreateTag?.(searchValue.trim())
                        setSearchValue("")
                      }}
                      className="cursor-pointer"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create "{searchValue.trim()}"
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => {
            const { bg, text } = getTagColor(tag.name, tag.color)
            
            return (
              <Badge
                key={tag.name}
                variant="secondary"
                className={cn(bg, text, "pr-1")}
              >
                {tag.name}
                <button
                  type="button"
                  className={cn(
                    "ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    disabled && "pointer-events-none opacity-50"
                  )}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRemove(tag.name)
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={() => handleRemove(tag.name)}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Remove {tag.name}</span>
                </button>
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
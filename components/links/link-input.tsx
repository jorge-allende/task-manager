"use client"

import * as React from "react"
import { useState, useCallback } from "react"
import { Link, Plus, X, ExternalLink, Globe, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface TaskLink {
  url: string
  title: string
  favicon?: string
}

interface LinkInputProps {
  value?: TaskLink[]
  onChange?: (links: TaskLink[]) => void
  className?: string
  maxLinks?: number
  placeholder?: string
}

// Helper to validate URL
function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

// Helper to extract domain from URL
function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace("www.", "")
  } catch {
    return "link"
  }
}

// Helper to get favicon URL
function getFaviconUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`
  } catch {
    return ""
  }
}

export function LinkInput({
  value = [],
  onChange,
  className,
  maxLinks = 10,
  placeholder = "https://example.com",
}: LinkInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const [titleInput, setTitleInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAddLink = useCallback(async () => {
    setError(null)

    // Validate URL
    if (!isValidUrl(urlInput)) {
      setError("Please enter a valid URL")
      return
    }

    // Check max links
    if (value.length >= maxLinks) {
      setError(`Maximum ${maxLinks} links allowed`)
      return
    }

    // Check for duplicates
    if (value.some((link) => link.url === urlInput)) {
      setError("This link has already been added")
      return
    }

    setIsLoading(true)

    try {
      // Use provided title or extract from URL
      const title = titleInput.trim() || getDomainFromUrl(urlInput)
      const favicon = getFaviconUrl(urlInput)

      const newLink: TaskLink = {
        url: urlInput,
        title,
        favicon,
      }

      // Update the value
      if (onChange) {
        onChange([...value, newLink])
      }

      // Reset form
      setUrlInput("")
      setTitleInput("")
      setIsOpen(false)
    } catch (error) {
      setError("Failed to add link")
    } finally {
      setIsLoading(false)
    }
  }, [urlInput, titleInput, value, onChange, maxLinks])

  const handleRemoveLink = useCallback(
    (index: number) => {
      if (onChange) {
        const newLinks = value.filter((_, i) => i !== index)
        onChange(newLinks)
      }
    },
    [value, onChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleAddLink()
      }
    },
    [handleAddLink]
  )

  return (
    <div className={cn("space-y-3", className)}>
      {/* Existing links */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((link, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card group"
            >
              {link.favicon ? (
                <img
                  src={link.favicon}
                  alt=""
                  className="h-5 w-5 rounded shrink-0"
                  onError={(e) => {
                    // Fallback to Globe icon if favicon fails to load
                    e.currentTarget.style.display = "none"
                    e.currentTarget.nextElementSibling?.classList.remove("hidden")
                  }}
                />
              ) : null}
              <Globe className={cn("h-5 w-5 text-muted-foreground shrink-0", link.favicon && "hidden")} />
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{link.title}</p>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary truncate block"
                >
                  {link.url}
                </a>
              </div>

              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  asChild
                >
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${link.title} in new tab`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleRemoveLink(index)}
                  aria-label={`Remove ${link.title}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add link button */}
      {value.length < maxLinks && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add link
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Add a link</h4>
                <p className="text-sm text-muted-foreground">
                  Add a relevant link to this task
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    placeholder={placeholder}
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title (optional)</Label>
                  <Input
                    id="title"
                    placeholder="Link title"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsOpen(false)
                      setUrlInput("")
                      setTitleInput("")
                      setError(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddLink}
                    disabled={!urlInput || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Adding...
                      </>
                    ) : (
                      "Add link"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Empty state */}
      {value.length === 0 && value.length >= maxLinks && (
        <div className="text-center py-6 text-muted-foreground">
          <Link className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No links added</p>
        </div>
      )}
    </div>
  )
}
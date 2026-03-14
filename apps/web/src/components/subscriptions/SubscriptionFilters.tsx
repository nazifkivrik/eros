"use client";

import { Search, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface SubscriptionFiltersProps {
  // Main page props
  tab?: string;
  includeMetaless?: boolean;
  onMetalessChange?: (checked: boolean) => void;
  // Detail page props
  showMetadataLess?: boolean;
  onMetadataLessChange?: (checked: boolean) => void;
  showInactive?: boolean;
  onInactiveChange?: (checked: boolean) => void;
  // Common props
  search: string;
  onSearchChange: (search: string) => void;
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  onClearTags: () => void;
  availableTags?: string[];
  showTagFilter?: boolean;
  // New advanced filter props
  availablePerformers?: Array<{ id: string; name: string }>;
  selectedPerformers?: string[];
  onPerformerToggle?: (performerId: string) => void;
  onClearPerformers?: () => void;
  showPerformerFilter?: boolean;
  downloadStatus?: 'all' | 'downloaded' | 'downloading' | 'not_downloaded';
  onDownloadStatusChange?: (status: 'all' | 'downloaded' | 'downloading' | 'not_downloaded') => void;
  showDownloadStatusFilter?: boolean;
}

export function SubscriptionFilters({
  tab,
  includeMetaless,
  onMetalessChange,
  showMetadataLess,
  onMetadataLessChange,
  showInactive,
  onInactiveChange,
  search,
  onSearchChange,
  selectedTags,
  onTagToggle,
  onClearTags,
  availableTags = [],
  showTagFilter = false,
  availablePerformers = [],
  selectedPerformers = [],
  onPerformerToggle,
  onClearPerformers,
  showPerformerFilter = false,
  downloadStatus = 'all',
  onDownloadStatusChange,
  showDownloadStatusFilter = false,
}: SubscriptionFiltersProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const hasActiveFilters = selectedTags.length > 0 || selectedPerformers.length > 0 || downloadStatus !== 'all';

  return (
    <div className="space-y-3">
      {/* Main filters row - Search and checkboxes */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Checkboxes */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Include metaless - Main page, scenes tab only */}
          {tab === "scenes" && onMetalessChange && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-metaless"
                checked={includeMetaless}
                onCheckedChange={(checked) => onMetalessChange(checked as boolean)}
              />
              <Label
                htmlFor="include-metaless"
                className="text-sm cursor-pointer whitespace-nowrap"
              >
                Include metaless
              </Label>
            </div>
          )}

          {/* Show only metadata-less - Detail page */}
          {showMetadataLess !== undefined && onMetadataLessChange && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-metadata-less"
                checked={showMetadataLess}
                onCheckedChange={(checked) => onMetadataLessChange(checked as boolean)}
              />
              <Label
                htmlFor="show-metadata-less"
                className="text-sm cursor-pointer whitespace-nowrap"
              >
                Show only metadata-less
              </Label>
            </div>
          )}

          {/* Show unsubscribed - Detail page */}
          {showInactive !== undefined && onInactiveChange && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={(checked) => onInactiveChange(checked as boolean)}
              />
              <Label
                htmlFor="show-inactive"
                className="text-sm cursor-pointer whitespace-nowrap"
              >
                Show unsubscribed
              </Label>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filters Toggle - Only show for scenes tab */}
      {(showTagFilter || showPerformerFilter || showDownloadStatusFilter) && (
        <div className="border rounded-lg bg-muted/30 overflow-hidden">
          {/* Toggle Button */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                Advanced Filters
              </span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  {selectedTags.length + selectedPerformers.length + (downloadStatus !== 'all' ? 1 : 0)}
                </Badge>
              )}
            </div>
            {showAdvancedFilters ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {/* Advanced Filters Content */}
          {showAdvancedFilters && (
            <div className="border-t p-4 space-y-4">
              {/* Download Status */}
              {showDownloadStatusFilter && (
                <div className="flex items-center gap-3">
                  <Label className="text-sm text-muted-foreground min-w-[100px]">
                    Download status
                  </Label>
                  <Select value={downloadStatus} onValueChange={onDownloadStatusChange!}>
                    <SelectTrigger className="w-full max-w-[200px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="downloaded">Downloaded</SelectItem>
                      <SelectItem value="downloading">Downloading</SelectItem>
                      <SelectItem value="not_downloaded">Not Downloaded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tag Filter - Compact */}
              {showTagFilter && availableTags.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-muted-foreground">
                      Tags
                    </Label>
                    {selectedTags.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearTags}
                        className="h-6 text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-20 w-full border rounded-md p-2">
                    <div className="flex flex-wrap gap-1.5">
                      {availableTags.map((tag) => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <Badge
                            key={tag}
                            variant={isSelected ? "default" : "outline"}
                            className={cn(
                              "cursor-pointer hover:opacity-80 transition-opacity text-xs",
                              isSelected && "bg-primary text-primary-foreground"
                            )}
                            onClick={() => onTagToggle(tag)}
                          >
                            {tag}
                          </Badge>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Performer Filter - Compact with Search */}
              {showPerformerFilter && availablePerformers.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-muted-foreground">
                      Performers
                    </Label>
                    {selectedPerformers.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearPerformers!}
                        className="h-6 text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-32 w-full border rounded-md p-2">
                    <div className="flex flex-col gap-1">
                      {availablePerformers.map((performer) => {
                        const isSelected = selectedPerformers.includes(performer.id);
                        return (
                          <button
                            key={performer.id}
                            onClick={() => onPerformerToggle!(performer.id)}
                            className={cn(
                              "text-left px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors",
                              isSelected && "bg-primary text-primary-foreground hover:bg-primary/90"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{performer.name}</span>
                              {isSelected && (
                                <span className="text-xs">✓</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Empty State */}
              {((showTagFilter && availableTags.length === 0) ||
               (showPerformerFilter && availablePerformers.length === 0)) && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No filters available - scenes may not have metadata loaded yet
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

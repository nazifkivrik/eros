import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TagFilter } from "./TagFilter";

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
}: SubscriptionFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
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
        <div className="flex items-center gap-4">
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
                className="text-sm cursor-pointer"
              >
                Include metaless scenes
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
                className="text-sm cursor-pointer"
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
                className="text-sm cursor-pointer"
              >
                Show unsubscribed
              </Label>
            </div>
          )}
        </div>
      </div>

      {/* Tag Filter */}
      {showTagFilter && availableTags.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            Filter by tags {selectedTags.length > 0 && `(${selectedTags.length} selected)`}
          </Label>
          <TagFilter
            tags={availableTags}
            selectedTags={selectedTags}
            onTagToggle={onTagToggle}
            onClearAll={onClearTags}
          />
        </div>
      )}
    </div>
  );
}

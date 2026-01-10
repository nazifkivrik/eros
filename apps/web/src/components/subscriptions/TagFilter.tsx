import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagFilterProps {
  tags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  onClearAll: () => void;
}

export function TagFilter({ tags, selectedTags, onTagToggle, onClearAll }: TagFilterProps) {
  if (tags.length === 0) {
    return <p className="text-sm text-muted-foreground">No tags available</p>;
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {tags.map((tag) => {
        const isSelected = selectedTags.includes(tag);
        return (
          <Badge
            key={tag}
            variant={isSelected ? "default" : "outline"}
            className={cn(
              "cursor-pointer hover:opacity-80 transition-opacity",
              isSelected && "bg-primary text-primary-foreground"
            )}
            onClick={() => onTagToggle(tag)}
          >
            {tag}
            {isSelected && <X className="h-3 w-3 ml-1" />}
          </Badge>
        );
      })}
      {selectedTags.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-7 text-xs"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}

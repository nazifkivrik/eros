import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PerformerFilterProps {
  performers: Array<{ id: string; name: string }>;
  selectedPerformers: string[];
  onPerformerToggle: (performerId: string) => void;
  onClearAll: () => void;
}

export function PerformerFilter({
  performers,
  selectedPerformers,
  onPerformerToggle,
  onClearAll,
}: PerformerFilterProps) {
  if (performers.length === 0) {
    return <p className="text-sm text-muted-foreground">No performers available</p>;
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {performers.map((performer) => {
        const isSelected = selectedPerformers.includes(performer.id);
        return (
          <Badge
            key={performer.id}
            variant={isSelected ? "default" : "outline"}
            className={cn(
              "cursor-pointer hover:opacity-80 transition-opacity",
              isSelected && "bg-primary text-primary-foreground"
            )}
            onClick={() => onPerformerToggle(performer.id)}
          >
            {performer.name}
            {isSelected && <X className="h-3 w-3 ml-1" />}
          </Badge>
        );
      })}
      {selectedPerformers.length > 0 && (
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

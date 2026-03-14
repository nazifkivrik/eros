import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Circle, Download, List } from "lucide-react";
import { cn } from "@/lib/utils";

interface DownloadStatusFilterProps {
  value: 'all' | 'downloaded' | 'downloading' | 'not_downloaded';
  onChange: (value: 'all' | 'downloaded' | 'downloading' | 'not_downloaded') => void;
}

export function DownloadStatusFilter({ value, onChange }: DownloadStatusFilterProps) {
  const options = [
    { value: 'all', label: 'All', icon: List },
    { value: 'downloaded', label: 'Downloaded', icon: CheckCircle },
    { value: 'downloading', label: 'Downloading', icon: Download },
    { value: 'not_downloaded', label: 'Not Downloaded', icon: Circle },
  ] as const;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full md:w-[200px]">
        <SelectValue placeholder="Filter by status" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <Icon className={cn(
                  "h-4 w-4",
                  option.value === 'downloaded' && "text-green-600",
                  option.value === 'downloading' && "text-blue-600",
                  option.value === 'not_downloaded' && "text-muted-foreground"
                )} />
                <span>{option.label}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

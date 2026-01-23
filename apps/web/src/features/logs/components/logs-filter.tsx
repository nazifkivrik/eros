"use client";

import { Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LogLevel, EventType } from "@repo/shared-types";

const LOG_LEVELS = [
  { value: "error", label: "Error" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
  { value: "debug", label: "Debug" },
];

const EVENT_TYPES = [
  { value: "torrent", label: "Torrent" },
  { value: "subscription", label: "Subscription" },
  { value: "download", label: "Download" },
  { value: "metadata", label: "Metadata" },
  { value: "system", label: "System" },
];

type Props = {
  level?: LogLevel;
  eventType?: EventType;
  onLevelChange: (level: LogLevel | undefined) => void;
  onEventTypeChange: (eventType: EventType | undefined) => void;
};

/**
 * Logs Filter Component
 * Presentational only - receives filter values and change handlers as props
 */
export function LogsFilter({ level, eventType, onLevelChange, onEventTypeChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Log Level</label>
            <Select
              value={level || "all"}
              onValueChange={(v) => onLevelChange(v === "all" ? undefined : (v as LogLevel))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {LOG_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Event Type</label>
            <Select
              value={eventType || "all"}
              onValueChange={(v) => onEventTypeChange(v === "all" ? undefined : (v as EventType))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {EVENT_TYPES.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

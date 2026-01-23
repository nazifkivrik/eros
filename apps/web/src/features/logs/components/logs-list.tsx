"use client";

import { formatDistanceToNow } from "date-fns";
import { XCircle, AlertTriangle, Info, Bug } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const LOG_LEVELS = [
  { value: "error", label: "Error", icon: XCircle, color: "text-red-500" },
  { value: "warning", label: "Warning", icon: AlertTriangle, color: "text-yellow-500" },
  { value: "info", label: "Info", icon: Info, color: "text-blue-500" },
  { value: "debug", label: "Debug", icon: Bug, color: "text-gray-500" },
];

export type LogEntry = {
  id: string;
  level: string;
  eventType: string;
  message: string;
  details: Record<string, unknown> | null;
  sceneId: string | null;
  performerId: string | null;
  studioId: string | null;
  createdAt: string;
};

type Props = {
  logs: LogEntry[];
  onLogClick: (log: LogEntry) => void;
};

/**
 * Logs List Component
 * Presentational only - displays logs as cards
 */
export function LogsList({ logs, onLogClick }: Props) {
  const getLevelBadge = (logLevel: string) => {
    const levelConfig = LOG_LEVELS.find((l) => l.value === logLevel);
    if (!levelConfig) return null;

    const Icon = levelConfig.icon;
    return (
      <Badge
        variant={
          logLevel === "error"
            ? "destructive"
            : logLevel === "warning"
            ? "outline"
            : "secondary"
        }
        className="gap-1"
      >
        <Icon className={`h-3 w-3 ${levelConfig.color}`} />
        {levelConfig.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <Card
          key={log.id}
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => onLogClick(log)}
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {getLevelBadge(log.level)}
                  <Badge variant="outline">{log.eventType}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm font-medium truncate">{log.message}</p>
                {log.details && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {JSON.stringify(log.details)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

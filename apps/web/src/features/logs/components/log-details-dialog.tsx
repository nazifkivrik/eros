"use client";

import { formatDistanceToNow } from "date-fns";
import { XCircle, AlertTriangle, Info, Bug } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { LogEntry } from "./logs-list";

const LOG_LEVELS = [
  { value: "error", label: "Error", icon: XCircle, color: "text-red-500" },
  { value: "warning", label: "Warning", icon: AlertTriangle, color: "text-yellow-500" },
  { value: "info", label: "Info", icon: Info, color: "text-blue-500" },
  { value: "debug", label: "Debug", icon: Bug, color: "text-gray-500" },
];

type Props = {
  log: LogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Log Details Dialog Component
 * Shows detailed information about a selected log entry
 */
export function LogDetailsDialog({ log, open, onOpenChange }: Props) {
  if (!log) return null;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Details</DialogTitle>
          <DialogDescription>
            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Level</label>
              <div className="mt-1">{getLevelBadge(log.level)}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Event Type</label>
              <div className="mt-1">
                <Badge variant="outline">{log.eventType}</Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
              <p className="text-sm mt-1">{new Date(log.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Log ID</label>
              <p className="text-sm mt-1 font-mono">{log.id}</p>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Message</label>
            <p className="text-sm mt-1 whitespace-pre-wrap">{log.message}</p>
          </div>

          {/* Details */}
          {log.details && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Details</label>
              <pre className="mt-1 p-4 bg-muted rounded-lg text-xs overflow-x-auto">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          )}

          {/* Related Entities */}
          {(log.sceneId || log.performerId || log.studioId) && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Related Entities</label>
              <div className="mt-2 space-y-1">
                {log.sceneId && (
                  <p className="text-sm">
                    <span className="font-medium">Scene:</span>{" "}
                    <span className="font-mono">{log.sceneId}</span>
                  </p>
                )}
                {log.performerId && (
                  <p className="text-sm">
                    <span className="font-medium">Performer:</span>{" "}
                    <span className="font-mono">{log.performerId}</span>
                  </p>
                )}
                {log.studioId && (
                  <p className="text-sm">
                    <span className="font-medium">Studio:</span>{" "}
                    <span className="font-mono">{log.studioId}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

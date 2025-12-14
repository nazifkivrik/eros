"use client";

import { useState } from "react";
import { Filter, Trash2, AlertCircle, Info, AlertTriangle, Bug, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLogs, useCleanupLogs } from "@/hooks/useLogs";
import { formatDistanceToNow } from "date-fns";

const LOG_LEVELS = [
  { value: "error", label: "Error", icon: XCircle, color: "text-red-500" },
  { value: "warning", label: "Warning", icon: AlertTriangle, color: "text-yellow-500" },
  { value: "info", label: "Info", icon: Info, color: "text-blue-500" },
  { value: "debug", label: "Debug", icon: Bug, color: "text-gray-500" },
];

const EVENT_TYPES = [
  { value: "torrent", label: "Torrent" },
  { value: "subscription", label: "Subscription" },
  { value: "download", label: "Download" },
  { value: "metadata", label: "Metadata" },
  { value: "system", label: "System" },
];

export default function LogsPage() {
  const [level, setLevel] = useState<string | undefined>();
  const [eventType, setEventType] = useState<string | undefined>();
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const { data: logs, isLoading } = useLogs({
    level: level as any,
    eventType: eventType as any,
    limit: 100,
  });

  const cleanupLogs = useCleanupLogs();

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

  const handleCleanup = () => {
    cleanupLogs.mutate(30);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Logs</h1>
          <p className="text-muted-foreground">
            Monitor application events and troubleshoot issues
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleCleanup}
          disabled={cleanupLogs.isPending}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Cleanup Old Logs
        </Button>
      </div>

      {/* Filters */}
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
              <Select value={level || "all"} onValueChange={(v) => setLevel(v === "all" ? undefined : v)}>
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
              <Select value={eventType || "all"} onValueChange={(v) => setEventType(v === "all" ? undefined : v)}>
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

      {/* Logs List */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-3/4" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : logs?.data?.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No logs found matching the selected filters.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-2">
          {logs?.data?.map((log: any) => (
            <Card
              key={log.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setSelectedLog(log)}
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
      )}

      {/* Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Details</DialogTitle>
            <DialogDescription>
              {selectedLog && formatDistanceToNow(new Date(selectedLog.createdAt), { addSuffix: true })}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Level</label>
                  <div className="mt-1">{getLevelBadge(selectedLog.level)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Event Type</label>
                  <div className="mt-1">
                    <Badge variant="outline">{selectedLog.eventType}</Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                  <p className="text-sm mt-1">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Log ID</label>
                  <p className="text-sm mt-1 font-mono">{selectedLog.id}</p>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Message</label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{selectedLog.message}</p>
              </div>

              {/* Details */}
              {selectedLog.details && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Details</label>
                  <pre className="mt-1 p-4 bg-muted rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {/* Related Entities */}
              {(selectedLog.sceneId || selectedLog.performerId || selectedLog.studioId) && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Related Entities</label>
                  <div className="mt-2 space-y-1">
                    {selectedLog.sceneId && (
                      <p className="text-sm">
                        <span className="font-medium">Scene:</span>{" "}
                        <span className="font-mono">{selectedLog.sceneId}</span>
                      </p>
                    )}
                    {selectedLog.performerId && (
                      <p className="text-sm">
                        <span className="font-medium">Performer:</span>{" "}
                        <span className="font-mono">{selectedLog.performerId}</span>
                      </p>
                    )}
                    {selectedLog.studioId && (
                      <p className="text-sm">
                        <span className="font-medium">Studio:</span>{" "}
                        <span className="font-mono">{selectedLog.studioId}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

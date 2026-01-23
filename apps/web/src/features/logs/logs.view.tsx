"use client";

import { useState } from "react";
import { useLogs, useCleanupLogs, type LogFilters } from "./hooks/use-logs";
import { LogsFilter } from "./components/logs-filter";
import { LogsList, type LogEntry } from "./components/logs-list";
import { LogsSkeleton } from "./components/logs-skeleton";
import { LogsEmpty } from "./components/logs-empty";
import { LogsHeader } from "./components/logs-header";
import { LogDetailsDialog } from "./components/log-details-dialog";

/**
 * Logs View
 * Composes logs UI components and manages data fetching
 * Handles state orchestration but no direct UI rendering
 */
export function LogsView() {
  const [level, setLevel] = useState<LogFilters["level"]>();
  const [eventType, setEventType] = useState<LogFilters["eventType"]>();
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const { data: logs, isLoading } = useLogs({
    level,
    eventType,
    limit: 100,
  });

  const cleanupLogs = useCleanupLogs();

  const handleCleanup = () => {
    cleanupLogs.mutate(30);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LogsHeader onCleanup={handleCleanup} isPending={false} />
        <LogsFilter
          level={level}
          eventType={eventType}
          onLevelChange={setLevel}
          onEventTypeChange={setEventType}
        />
        <LogsSkeleton />
      </div>
    );
  }

  if (!logs?.data?.length) {
    return (
      <div className="space-y-6">
        <LogsHeader onCleanup={handleCleanup} isPending={cleanupLogs.isPending} />
        <LogsFilter
          level={level}
          eventType={eventType}
          onLevelChange={setLevel}
          onEventTypeChange={setEventType}
        />
        <LogsEmpty />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LogsHeader onCleanup={handleCleanup} isPending={cleanupLogs.isPending} />
      <LogsFilter
        level={level}
        eventType={eventType}
        onLevelChange={setLevel}
        onEventTypeChange={setEventType}
      />
      <LogsList logs={logs.data} onLogClick={setSelectedLog} />
      <LogDetailsDialog
        log={selectedLog}
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      />
    </div>
  );
}

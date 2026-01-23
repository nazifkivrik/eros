"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import type { LogLevel, EventType } from "@repo/shared-types";

export interface LogFilters {
  level?: LogLevel;
  eventType?: EventType;
  sceneId?: string;
  performerId?: string;
  studioId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Data fetching hook for logs
 * Handles fetching logs with optional filters
 */
export function useLogs(filters?: LogFilters) {
  return useQuery({
    queryKey: [...queryKeys.logs.all, filters],
    queryFn: () => apiClient.getLogs(filters),
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    staleTime: 5000,
  });
}

/**
 * Data fetching hook for single log
 * Note: Currently unused as log details are passed via the list
 */
export function useLog(id: string) {
  return useQuery({
    queryKey: ["logs", id],
    queryFn: () => apiClient.getLog(id),
    enabled: !!id,
  });
}

/**
 * Mutation hook for cleaning up old logs
 */
export function useCleanupLogs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (daysToKeep: number) => apiClient.cleanupLogs(daysToKeep),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.logs.all });
      toast.success(`Deleted ${data.deletedCount} old log entries`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cleanup logs");
    },
  });
}

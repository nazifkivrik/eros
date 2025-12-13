"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface LogFilters {
  level?: "error" | "warning" | "info" | "debug";
  eventType?: "torrent" | "subscription" | "download" | "metadata" | "system";
  sceneId?: string;
  performerId?: string;
  studioId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export function useLogs(filters?: LogFilters) {
  return useQuery({
    queryKey: ["logs", filters],
    queryFn: () => apiClient.getLogs(filters),
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });
}

export function useLog(id: string) {
  return useQuery({
    queryKey: ["logs", id],
    queryFn: () => apiClient.getLog(id),
    enabled: !!id,
  });
}

export function useCleanupLogs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (daysToKeep: number) => apiClient.cleanupLogs(daysToKeep),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      toast.success(`Deleted ${data.deletedCount} old log entries`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cleanup logs");
    },
  });
}

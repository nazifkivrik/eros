"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";

/**
 * Data fetching hook for jobs
 */
export function useJobs() {
  return useQuery({
    queryKey: queryKeys.jobs.all,
    queryFn: () => apiClient.getJobs(),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  });
}

/**
 * Mutation hook for triggering a job
 */
export function useTriggerJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobName: string) => apiClient.triggerJob(jobName),
    onSuccess: (_, jobName) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      toast.success(`Job "${jobName}" triggered successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to trigger job");
    },
  });
}

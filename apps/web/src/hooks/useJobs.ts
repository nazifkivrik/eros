"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: () => apiClient.getJobs(),
  });
}

export function useTriggerJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobName: string) => apiClient.triggerJob(jobName),
    onSuccess: (_, jobName) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success(`Job "${jobName}" triggered successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to trigger job");
    },
  });
}

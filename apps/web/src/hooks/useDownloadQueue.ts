"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export function useDownloadQueue() {
  return useQuery({
    queryKey: ["downloadQueue"],
    queryFn: () => apiClient.getDownloadQueue(),
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });
}

export function usePauseDownload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.pauseDownload(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["downloadQueue"] });
      queryClient.invalidateQueries({ queryKey: ["unified-downloads"] });
      toast.success("Download paused");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to pause download");
    },
  });
}

export function useResumeDownload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.resumeDownload(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["downloadQueue"] });
      queryClient.invalidateQueries({ queryKey: ["unified-downloads"] });
      toast.success("Download resumed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to resume download");
    },
  });
}

export function useRemoveDownload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.removeDownload(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["downloadQueue"] });
      queryClient.invalidateQueries({ queryKey: ["unified-downloads"] });
      toast.success("Download removed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove download");
    },
  });
}

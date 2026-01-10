"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useMutationWithToast } from "./useMutationWithToast";

export type UnifiedDownloadStatus =
  | "queued"
  | "downloading"
  | "completed"
  | "seeding"
  | "paused"
  | "failed"
  | "add_failed";

export interface UnifiedDownload {
  id: string;
  sceneId: string;
  sceneTitle: string;
  scenePoster: string | null;
  sceneStudio: string | null;
  qbitHash: string | null;
  status: UnifiedDownloadStatus;
  progress: number | null; // 0-1
  downloadSpeed: number | null; // bytes/sec
  uploadSpeed: number | null; // bytes/sec
  eta: number | null; // seconds
  size: number;
  seeders: number;
  leechers: number;
  quality: string;
  priority: number | null;
  addedAt: string;
  completedAt: string | null;
}

interface UnifiedDownloadsResponse {
  downloads: UnifiedDownload[];
}

export function useUnifiedDownloads() {
  return useQuery<UnifiedDownloadsResponse>({
    queryKey: queryKeys.downloads.unified,
    queryFn: async () => {
      console.log("Fetching downloads from /api/download-queue/unified");
      // Use relative URL for browser (works in both dev and Docker)
      const res = await fetch(`/api/download-queue/unified`);
      console.log("Downloads API response status:", res.status, res.ok);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Downloads API error:", res.status, errorText);
        throw new Error(`Failed to fetch unified downloads: ${res.status} ${errorText}`);
      }
      const data = await res.json();
      console.log("Downloads API response:", data);
      return data;
    },
    refetchInterval: 2000, // Refresh every 2 seconds for real-time updates
    refetchOnWindowFocus: true, // Refresh when window regains focus
    staleTime: 1000, // Consider data stale after 1 second
  });
}

export function useDownloadQueue() {
  return useQuery({
    queryKey: queryKeys.downloads.queue,
    queryFn: () => apiClient.getDownloadQueue(),
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });
}

export function usePauseDownload() {
  return useMutationWithToast({
    mutationFn: (id: string) => apiClient.pauseDownload(id),
    successMessage: "Download paused",
    invalidateKeys: [queryKeys.downloads.queue, queryKeys.downloads.unified],
    errorMessage: "Failed to pause download",
  });
}

export function useResumeDownload() {
  return useMutationWithToast({
    mutationFn: (id: string) => apiClient.resumeDownload(id),
    successMessage: "Download resumed",
    invalidateKeys: [queryKeys.downloads.queue, queryKeys.downloads.unified],
    errorMessage: "Failed to resume download",
  });
}

export function useRemoveDownload() {
  return useMutationWithToast({
    mutationFn: (id: string) => apiClient.removeDownload(id),
    successMessage: "Download removed",
    invalidateKeys: [queryKeys.downloads.queue, queryKeys.downloads.unified],
    errorMessage: "Failed to remove download",
  });
}

export function useRetryDownload() {
  return useMutationWithToast({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/download-queue/${id}/retry`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to retry download");
      }
      return response.json();
    },
    successMessage: "Download retry initiated",
    invalidateKeys: [queryKeys.downloads.queue, queryKeys.downloads.unified],
    errorMessage: "Failed to retry download",
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/**
 * Type for subscription file information
 */
export interface SubscriptionFiles {
  files: Array<{
    id: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    downloadedAt: string;
    quality?: string;
  }>;
  downloadQueue: {
    id: string;
    status: string;
    progress: number;
    size: number;
    downloaded: number;
    speed: number;
    eta: number;
    title?: string;
    quality?: string;
    addedAt?: string;
    completedAt?: string;
  } | null;
  sceneFolder: string | null;
  folderContents: {
    nfoFiles: string[];
    posterFiles: string[];
    videoFiles: string[];
  };
}

/**
 * Hook for fetching files and download status for a scene subscription
 * Returns:
 * - Downloaded files list
 * - Current download queue status (if any)
 * - Scene folder path
 * - Folder contents (NFO, posters, videos)
 *
 * @param subscriptionId - ID of the scene subscription
 * @param enabled - Query enabled flag (useful for conditional fetching)
 */
export function useSubscriptionFiles(subscriptionId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.subscriptions.files(subscriptionId),
    queryFn: async () => {
      const response = await apiClient.getSubscriptionFiles(subscriptionId);
      return response as SubscriptionFiles;
    },
    enabled: enabled && !!subscriptionId,
    staleTime: 2 * 60 * 1000, // 2 minutes - files can change more frequently
    refetchInterval: 30 * 1000, // Poll every 30 seconds for download updates
  });
}

/**
 * Computed values for subscription files
 */
export interface SubscriptionFilesStatus {
  hasFiles: boolean;
  hasVideoFiles: boolean;
  hasPosterFiles: boolean;
  hasNfoFiles: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  videoFileCount: number;
}

/**
 * Hook that returns computed status for subscription files
 * Useful for UI to quickly check file status without manual checks
 *
 * @param subscriptionId - ID of the scene subscription
 * @param enabled - Query enabled flag
 */
export function useSubscriptionFilesStatus(
  subscriptionId: string,
  enabled: boolean = true
) {
  const { data: filesData, isLoading } = useSubscriptionFiles(subscriptionId, enabled);

  const status: SubscriptionFilesStatus | undefined = filesData
    ? {
        hasFiles: filesData.files.length > 0,
        hasVideoFiles: filesData.folderContents.videoFiles.length > 0,
        hasPosterFiles: filesData.folderContents.posterFiles.length > 0,
        hasNfoFiles: filesData.folderContents.nfoFiles.length > 0,
        isDownloading: filesData.downloadQueue?.status === "downloading" || false,
        downloadProgress: filesData.downloadQueue?.progress || 0,
        videoFileCount: filesData.folderContents.videoFiles.length,
      }
    : undefined;

  return {
    status,
    isLoading,
    filesData,
  };
}

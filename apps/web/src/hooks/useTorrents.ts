"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useMutationWithToast } from "./useMutationWithToast";

export function useTorrents() {
  return useQuery({
    queryKey: queryKeys.torrents.all,
    queryFn: () => apiClient.getTorrents(),
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });
}

export function usePauseTorrent() {
  return useMutationWithToast({
    mutationFn: (hash: string) => apiClient.pauseTorrent(hash),
    successMessage: "Torrent paused",
    invalidateKeys: [queryKeys.torrents.all, queryKeys.downloads.queue, queryKeys.downloads.unified],
    errorMessage: "Failed to pause torrent",
  });
}

export function useResumeTorrent() {
  return useMutationWithToast({
    mutationFn: (hash: string) => apiClient.resumeTorrent(hash),
    successMessage: "Torrent resumed",
    invalidateKeys: [queryKeys.torrents.all, queryKeys.downloads.queue, queryKeys.downloads.unified],
    errorMessage: "Failed to resume torrent",
  });
}

export function useRemoveTorrent() {
  return useMutationWithToast({
    mutationFn: ({ hash, deleteFiles }: { hash: string; deleteFiles?: boolean }) =>
      apiClient.removeTorrent(hash, deleteFiles),
    successMessage: "Torrent removed",
    invalidateKeys: [queryKeys.torrents.all, queryKeys.downloads.queue, queryKeys.downloads.unified],
    errorMessage: "Failed to remove torrent",
  });
}

export function useSetTorrentPriority() {
  return useMutationWithToast({
    mutationFn: ({
      hash,
      priority,
    }: {
      hash: string;
      priority: "top" | "bottom" | "increase" | "decrease";
    }) => apiClient.setTorrentPriority(hash, priority),
    successMessage: "Priority updated",
    invalidateKeys: [queryKeys.torrents.all, queryKeys.downloads.unified],
    errorMessage: "Failed to update priority",
  });
}

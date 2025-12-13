"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export function useTorrents() {
  return useQuery({
    queryKey: ["torrents"],
    queryFn: () => apiClient.getTorrents(),
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });
}

export function usePauseTorrent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (hash: string) => apiClient.pauseTorrent(hash),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["torrents"] });
      queryClient.invalidateQueries({ queryKey: ["downloadQueue"] });
      queryClient.invalidateQueries({ queryKey: ["unified-downloads"] });
      toast.success("Torrent paused");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to pause torrent");
    },
  });
}

export function useResumeTorrent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (hash: string) => apiClient.resumeTorrent(hash),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["torrents"] });
      queryClient.invalidateQueries({ queryKey: ["downloadQueue"] });
      queryClient.invalidateQueries({ queryKey: ["unified-downloads"] });
      toast.success("Torrent resumed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to resume torrent");
    },
  });
}

export function useRemoveTorrent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ hash, deleteFiles }: { hash: string; deleteFiles?: boolean }) =>
      apiClient.removeTorrent(hash, deleteFiles),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["torrents"] });
      queryClient.invalidateQueries({ queryKey: ["downloadQueue"] });
      queryClient.invalidateQueries({ queryKey: ["unified-downloads"] });
      toast.success("Torrent removed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove torrent");
    },
  });
}

export function useSetTorrentPriority() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      hash,
      priority,
    }: {
      hash: string;
      priority: "top" | "bottom" | "increase" | "decrease";
    }) => apiClient.setTorrentPriority(hash, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["torrents"] });
      queryClient.invalidateQueries({ queryKey: ["unified-downloads"] });
      toast.success("Priority updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update priority");
    },
  });
}

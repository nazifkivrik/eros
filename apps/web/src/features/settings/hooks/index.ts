import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: () => apiClient.getSettings(),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.updateSettings.bind(apiClient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success("Settings saved successfully");
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: ({ service, config }: {
      service: "stashdb" | "tpdb" | "prowlarr" | "qbittorrent";
      config?: { apiUrl: string; apiKey: string }
    }) =>
      apiClient.testServiceConnection(service, config),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Connection test failed");
    },
  });
}

export function useAIModelStatus() {
  return useQuery({
    queryKey: ["ai-model-status"],
    queryFn: () => apiClient.getAIModelStatus(),
    refetchInterval: 30000, // Poll every 30 seconds
    refetchOnWindowFocus: false,
  });
}

export function useLoadAIModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.loadAIModel.bind(apiClient),
    onSuccess: (data: { success: boolean; message: string; modelLoaded: boolean }) => {
      // Invalidate AI status to refresh
      queryClient.invalidateQueries({ queryKey: ["ai-model-status"] });

      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to download AI model");
    },
  });
}

export function useQBittorrentStatus() {
  return useQuery({
    queryKey: ["qbittorrent-status"],
    queryFn: () => apiClient.getQBittorrentStatus(),
    refetchInterval: 10000, // Poll every 10 seconds
    refetchOnWindowFocus: false,
  });
}

// Speed Schedule
export function useSpeedSchedule() {
  return useQuery({
    queryKey: ["speed-schedule"],
    queryFn: () => apiClient.getSpeedSchedule(),
  });
}

export function useUpdateSpeedSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.updateSpeedSchedule.bind(apiClient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["speed-schedule"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success("Speed schedule updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update speed schedule");
    },
  });
}

// Download Paths
export function useDownloadPaths() {
  return useQuery({
    queryKey: ["download-paths"],
    queryFn: () => apiClient.getDownloadPaths(),
  });
}

export function useUpdateDownloadPaths() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.updateDownloadPaths.bind(apiClient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["download-paths"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success("Download paths updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update download paths");
    },
  });
}

export function useCheckPathSpace() {
  return useMutation({
    mutationFn: (path: string) => apiClient.checkPathSpace(path),
  });
}

// User Credentials
export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      apiClient.changePassword(data),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to change password");
    },
  });
}

// ====== Providers Hooks ======

export function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: () => apiClient.getProviders(),
  });
}

// Metadata Providers
export function useAddMetadataProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.addMetadataProvider.bind(apiClient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success("Metadata provider added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add metadata provider");
    },
  });
}

export function useUpdateMetadataProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof apiClient.updateMetadataProvider>[1] }) =>
      apiClient.updateMetadataProvider(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success("Metadata provider updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update metadata provider");
    },
  });
}

export function useDeleteMetadataProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteMetadataProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success("Metadata provider deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete metadata provider");
    },
  });
}

export function useTestMetadataProvider() {
  return useMutation({
    mutationFn: (id: string) => apiClient.testMetadataProvider(id),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Connection test failed");
    },
  });
}

// Indexer Providers
export function useAddIndexerProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.addIndexerProvider.bind(apiClient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success("Indexer provider added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add indexer provider");
    },
  });
}

export function useUpdateIndexerProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof apiClient.updateIndexerProvider>[1] }) =>
      apiClient.updateIndexerProvider(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success("Indexer provider updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update indexer provider");
    },
  });
}

export function useDeleteIndexerProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteIndexerProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success("Indexer provider deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete indexer provider");
    },
  });
}

export function useTestIndexerProvider() {
  return useMutation({
    mutationFn: (id: string) => apiClient.testIndexerProvider(id),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Connection test failed");
    },
  });
}

// Torrent Client Providers
export function useAddTorrentClientProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.addTorrentClientProvider.bind(apiClient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success("Torrent client provider added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add torrent client provider");
    },
  });
}

export function useUpdateTorrentClientProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof apiClient.updateTorrentClientProvider>[1] }) =>
      apiClient.updateTorrentClientProvider(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success("Torrent client provider updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update torrent client provider");
    },
  });
}

export function useDeleteTorrentClientProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteTorrentClientProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success("Torrent client provider deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete torrent client provider");
    },
  });
}

export function useTestTorrentClientProvider() {
  return useMutation({
    mutationFn: (id: string) => apiClient.testTorrentClientProvider(id),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Connection test failed");
    },
  });
}

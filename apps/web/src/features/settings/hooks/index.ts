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

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => apiClient.getSettings(),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiClient.updateSettings.bind(apiClient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved successfully");
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (service: "stashdb" | "prowlarr" | "qbittorrent") =>
      apiClient.testServiceConnection(service),
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

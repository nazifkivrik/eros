import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

interface ManualSearchOptions {
  query?: string;
  limit?: number;
}

export function useManualSearch(sceneId: string, options: ManualSearchOptions, enabled = true) {
  return useQuery({
    queryKey: ["manual-search", sceneId, options.query, options.limit],
    queryFn: () => apiClient.manualSearchScene(sceneId, options),
    enabled: enabled && !!sceneId && (options.query?.length ?? 0) >= 3,
    staleTime: Infinity, // Cache indefinitely - Prowlarr results don't change quickly
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/**
 * Type for subscription scene
 */
export interface SubscriptionScene {
  id: string;
  title: string;
  date: string;
  contentType: string;
  code?: string;
  duration?: number;
  images?: { url: string; type: string }[];
  poster?: string;
  thumbnail?: string;
  description?: string;
  studio?: {
    id: string;
    name: string;
  };
  performers?: Array<{
    id: string;
    name: string;
    image: string;
  }>;
  downloadStatus?: {
    downloaded: boolean;
    inQueue: boolean;
    hasFiles: boolean;
  };
  folderPath?: string;
}

/**
 * Hook for fetching scenes for a performer or studio subscription
 * Returns scenes with download status information
 *
 * @param subscriptionId - ID of the subscription (performer or studio type)
 * @param enabled - Query enabled flag (useful for conditional fetching)
 */
export function useSubscriptionScenes(subscriptionId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.subscriptions.scenes(subscriptionId),
    queryFn: async () => {
      const response = await apiClient.getSubscriptionScenes(subscriptionId);
      return (response.data || []) as SubscriptionScene[];
    },
    enabled: enabled && !!subscriptionId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Type for discovery options when syncing scenes
 */
export interface DiscoveryOptions {
  includeScene?: boolean;
  includeJav?: boolean;
  includeMovie?: boolean;
  autoSave?: boolean;
  autoLink?: boolean;
}

/**
 * Type for discovery result
 */
export interface DiscoveryResult {
  totalFound: number;
  totalSaved: number;
  totalSkipped: number;
  errors: string[];
}

/**
 * Hook for discovering new scenes from metadata providers
 * This would trigger a background job to sync scenes from TPDB/StashDB
 *
 * Note: This endpoint may not be implemented yet in the backend
 * It's part of the Phase 3 discovery service integration
 */
export function useDiscoverScenes() {
  return {
    // This would be implemented when the discovery endpoint is added to the API
    // For now, this is a placeholder for future functionality
    discoverScenesForPerformer: async (
      _performerId: string,
      _options: DiscoveryOptions = {}
    ): Promise<DiscoveryResult> => {
      // TODO: Implement when discovery endpoint is ready
      throw new Error("Discovery endpoint not yet implemented");
    },
    discoverScenesForStudio: async (
      _studioId: string,
      _options: DiscoveryOptions = {}
    ): Promise<DiscoveryResult> => {
      // TODO: Implement when discovery endpoint is ready
      throw new Error("Discovery endpoint not yet implemented");
    },
  };
}

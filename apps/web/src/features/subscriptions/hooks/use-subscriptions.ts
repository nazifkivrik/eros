"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { SubscriptionSettings } from "@repo/shared-types";
import { queryKeys } from "@/lib/query-keys";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";

interface SubscriptionFilters {
  search?: string;
  includeMetaless?: boolean;
  showInactive?: boolean;
}

export function useSubscriptions(filters?: SubscriptionFilters) {
  // Note: showInactive is filtered client-side, not sent to API
  // Only include truthy params in query key to avoid cache issues
  // Don't send false values as query params (e.g., includeMetaless=false)
  const queryParams = Object.fromEntries(
    Object.entries({
      search: filters?.search,
      includeMetaless: filters?.includeMetaless,
    }).filter(([_, v]) => v) // filter out falsy values (undefined, false, empty string)
  );

  return useQuery({
    queryKey: [...queryKeys.subscriptions.all, queryParams],
    queryFn: () => apiClient.getSubscriptions(queryParams),
    staleTime: 1000 * 30, // 30 seconds - consider data fresh for 30s
  });
}

export function useSubscription(id: string) {
  return useQuery({
    queryKey: queryKeys.subscriptions.detail(id),
    queryFn: () => apiClient.getSubscription(id),
    enabled: !!id,
  });
}

export function useCheckSubscription(entityType: string, entityId: string) {
  return useQuery({
    queryKey: queryKeys.subscriptions.check(entityType, entityId),
    queryFn: () => apiClient.checkSubscription(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
}

export function useSubscribeToPerformer() {
  return useMutationWithToast({
    mutationFn: ({
      performerId,
      settings,
    }: {
      performerId: string;
      settings: SubscriptionSettings;
    }) => apiClient.subscribeToPerformer(performerId, settings),
    successMessage: "Subscribed to performer",
    invalidateKeys: [queryKeys.subscriptions.all, ["subscription", "check"]],
    errorMessage: "Failed to subscribe",
  });
}

export function useSubscribeToStudio() {
  return useMutationWithToast({
    mutationFn: ({
      studioId,
      settings,
    }: {
      studioId: string;
      settings: SubscriptionSettings;
    }) => apiClient.subscribeToStudio(studioId, settings),
    successMessage: "Subscribed to studio",
    invalidateKeys: [queryKeys.subscriptions.all, ["subscription", "check"]],
    errorMessage: "Failed to subscribe",
  });
}

export function useSubscribeToScene() {
  return useMutationWithToast({
    mutationFn: ({
      sceneId,
      settings,
    }: {
      sceneId: string;
      settings: SubscriptionSettings;
    }) => apiClient.subscribeToScene(sceneId, settings),
    successMessage: "Subscribed to scene",
    invalidateKeys: [queryKeys.subscriptions.all, ["subscription", "check"]],
    errorMessage: "Failed to subscribe",
  });
}

// Subscribe to a scene (creates new subscription with status="active")
export function useSubscribeScene() {
  return useMutationWithToast({
    mutationFn: ({
      sceneId,
      qualityProfileId,
    }: {
      sceneId: string;
      qualityProfileId: string;
    }) =>
      apiClient.subscribeToScene(sceneId, {
        qualityProfileId,
        autoDownload: true,
        includeMetadataMissing: false,
        includeAliases: false,
      }),
    successMessage: "Scene subscribed",
    errorMessage: "Failed to subscribe to scene",
    invalidateKeys: [queryKeys.subscriptions.all],
  });
}

// Unsubscribe from a scene (sets isSubscribed to false - doesn't delete)
// Note: parentSubscriptionId is needed to invalidate the scenes query cache
export function useUnsubscribeScene(parentSubscriptionId?: string) {
  return useMutationWithToast({
    mutationFn: ({ subscriptionId }: { subscriptionId: string }) =>
      apiClient.updateSubscription(subscriptionId, { isSubscribed: false }),
    successMessage: "Scene unsubscribed",
    errorMessage: "Failed to unsubscribe from scene",
    invalidateKeys: [
      queryKeys.subscriptions.all,
      parentSubscriptionId ? queryKeys.subscriptions.scenes(parentSubscriptionId) : null,
    ].filter(Boolean) as any[],
  });
}

// Resubscribe to a scene (sets isSubscribed back to true)
// Note: parentSubscriptionId is needed to invalidate the scenes query cache
export function useResubscribeScene(parentSubscriptionId?: string) {
  return useMutationWithToast({
    mutationFn: ({ subscriptionId }: { subscriptionId: string }) =>
      apiClient.updateSubscription(subscriptionId, { isSubscribed: true }),
    successMessage: "Scene resubscribed",
    errorMessage: "Failed to resubscribe to scene",
    invalidateKeys: [
      queryKeys.subscriptions.all,
      parentSubscriptionId ? queryKeys.subscriptions.scenes(parentSubscriptionId) : null,
    ].filter(Boolean) as any[],
  });
}

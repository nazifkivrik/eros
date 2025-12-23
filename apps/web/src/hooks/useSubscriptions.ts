"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { SubscriptionSettings } from "@repo/shared-types";
import { queryKeys } from "@/lib/query-keys";
import { useMutationWithToast } from "./useMutationWithToast";

export function useSubscriptions() {
  return useQuery({
    queryKey: queryKeys.subscriptions.all,
    queryFn: () => apiClient.getSubscriptions(),
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

export function useDeleteSubscription() {
  return useMutationWithToast({
    mutationFn: ({
      id,
      deleteAssociatedScenes,
      removeFiles,
    }: {
      id: string;
      deleteAssociatedScenes?: boolean;
      removeFiles?: boolean;
    }) => apiClient.deleteSubscription(id, deleteAssociatedScenes, removeFiles),
    successMessage: "Subscription removed",
    invalidateKeys: [queryKeys.subscriptions.all, ["subscription", "check"]],
    errorMessage: "Failed to remove subscription",
  });
}

export function useSubscriptionScenes(subscriptionId: string) {
  return useQuery({
    queryKey: queryKeys.subscriptions.scenes(subscriptionId),
    queryFn: async () => {
      // Use relative URL for browser (works in both dev and Docker)
      const response = await fetch(`/api/subscriptions/${subscriptionId}/scenes`);
      if (!response.ok) throw new Error("Failed to fetch scenes");
      return response.json();
    },
    enabled: !!subscriptionId,
  });
}

export function useSubscriptionFiles(subscriptionId: string) {
  return useQuery({
    queryKey: queryKeys.subscriptions.files(subscriptionId),
    queryFn: async () => {
      // Use relative URL for browser (works in both dev and Docker)
      const response = await fetch(`/api/subscriptions/${subscriptionId}/files`);
      if (!response.ok) throw new Error("Failed to fetch files");
      return response.json();
    },
    enabled: !!subscriptionId,
  });
}

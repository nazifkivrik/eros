"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export interface SubscriptionSettings {
  qualityProfileId: string;
  autoDownload: boolean;
  includeMetadataMissing: boolean;
  includeAliases: boolean;
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => apiClient.getSubscriptions(),
  });
}

export function useSubscription(id: string) {
  return useQuery({
    queryKey: ["subscription", id],
    queryFn: () => apiClient.getSubscription(id),
    enabled: !!id,
  });
}

export function useCheckSubscription(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ["subscription", "check", entityType, entityId],
    queryFn: () => apiClient.checkSubscription(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
}

export function useSubscribeToPerformer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      performerId,
      settings,
    }: {
      performerId: string;
      settings: SubscriptionSettings;
    }) => apiClient.subscribeToPerformer(performerId, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscription", "check"] });
      toast.success("Subscribed to performer");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to subscribe");
    },
  });
}

export function useSubscribeToStudio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      studioId,
      settings,
    }: {
      studioId: string;
      settings: SubscriptionSettings;
    }) => apiClient.subscribeToStudio(studioId, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscription", "check"] });
      toast.success("Subscribed to studio");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to subscribe");
    },
  });
}

export function useSubscribeToScene() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sceneId,
      settings,
    }: {
      sceneId: string;
      settings: SubscriptionSettings;
    }) => apiClient.subscribeToScene(sceneId, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscription", "check"] });
      toast.success("Subscribed to scene");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to subscribe");
    },
  });
}

export function useDeleteSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, deleteAssociatedScenes }: { id: string; deleteAssociatedScenes?: boolean }) =>
      apiClient.deleteSubscription(id, deleteAssociatedScenes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscription", "check"] });
      toast.success("Subscription removed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove subscription");
    },
  });
}

export function useSubscriptionScenes(subscriptionId: string) {
  return useQuery({
    queryKey: ["subscription", subscriptionId, "scenes"],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const response = await fetch(`${baseUrl}/subscriptions/${subscriptionId}/scenes`);
      if (!response.ok) throw new Error("Failed to fetch scenes");
      return response.json();
    },
    enabled: !!subscriptionId,
  });
}

export function useSubscriptionFiles(subscriptionId: string) {
  return useQuery({
    queryKey: ["subscription", subscriptionId, "files"],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const response = await fetch(`${baseUrl}/subscriptions/${subscriptionId}/files`);
      if (!response.ok) throw new Error("Failed to fetch files");
      return response.json();
    },
    enabled: !!subscriptionId,
  });
}

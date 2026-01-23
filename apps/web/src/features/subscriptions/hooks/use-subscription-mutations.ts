"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import type { SubscriptionSettings } from "@repo/shared-types";

/**
 * Hook for creating a new subscription
 */
export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      entityType: "performer" | "studio" | "scene";
      entityId: string;
      settings: SubscriptionSettings;
    }) => apiClient.createSubscription({
      entityType: data.entityType,
      entityId: data.entityId,
      ...data.settings,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
      toast.success("Subscription created");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create subscription");
    },
  });
}

/**
 * Hook for updating a subscription
 */
export function useUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: Partial<SubscriptionSettings & { isSubscribed: boolean }>;
    }) => apiClient.updateSubscription(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.detail(id) });
      toast.success("Subscription updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update subscription");
    },
  });
}

/**
 * Hook for deleting a subscription
 */
export function useDeleteSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, deleteAssociatedScenes, removeFiles }: {
      id: string;
      deleteAssociatedScenes?: boolean;
      removeFiles?: boolean;
    }) => apiClient.deleteSubscription(id, deleteAssociatedScenes ?? false, removeFiles ?? false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
      toast.success("Subscription deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete subscription");
    },
  });
}

/**
 * Hook for toggling subscription status (active/inactive)
 */
export function useToggleSubscriptionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.toggleSubscriptionStatus(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.detail(id) });
      toast.success("Subscription status updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update subscription status");
    },
  });
}

/**
 * Hook for unsubscribing (toggle isSubscribed to false)
 */
export function useUnsubscribe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.updateSubscription(id, { isSubscribed: false }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.detail(id) });
      toast.success("Unsubscribed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to unsubscribe");
    },
  });
}

/**
 * Hook for resubscribing (toggle isSubscribed to true)
 */
export function useResubscribe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.updateSubscription(id, { isSubscribed: true }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.detail(id) });
      toast.success("Resubscribed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to resubscribe");
    },
  });
}

import { apiClient } from "@/lib/api-client";
import { useMutationWithToast } from "./useMutationWithToast";

interface DeactivateSceneParams {
  subscriptionId: string;
  deactivate: boolean;
}

export function useDeactivateScene() {
  return useMutationWithToast({
    mutationFn: ({ subscriptionId, deactivate }: DeactivateSceneParams) =>
      apiClient.updateSubscription(subscriptionId, {
        isSubscribed: !deactivate,
      }),
    successMessage: "Scene status updated",
    invalidateKeys: [["subscriptions"]],
    errorMessage: "Failed to update scene status",
  });
}

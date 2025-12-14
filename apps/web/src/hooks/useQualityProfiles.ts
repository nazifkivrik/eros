"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useMutationWithToast } from "./useMutationWithToast";
import type { QualityItem } from "@repo/shared-types";

export function useQualityProfiles() {
  return useQuery({
    queryKey: queryKeys.qualityProfiles.all,
    queryFn: async () => {
      const response = await apiClient.getQualityProfiles();
      return response; // Return the whole response with { data: [...] }
    },
  });
}

export function useQualityProfile(id: string) {
  return useQuery({
    queryKey: queryKeys.qualityProfiles.detail(id),
    queryFn: () => apiClient.getQualityProfile(id),
    enabled: !!id,
  });
}

export function useCreateQualityProfile() {
  return useMutationWithToast({
    mutationFn: (data: {
      name: string;
      items: QualityItem[];
    }) => apiClient.createQualityProfile(data),
    successMessage: "Quality profile created",
    invalidateKeys: [queryKeys.qualityProfiles.all],
    errorMessage: "Failed to create quality profile",
  });
}

export function useUpdateQualityProfile() {
  return useMutationWithToast({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        name: string;
        items: QualityItem[];
      };
    }) => apiClient.updateQualityProfile(id, data),
    successMessage: "Quality profile updated",
    invalidateKeys: [queryKeys.qualityProfiles.all],
    errorMessage: "Failed to update quality profile",
  });
}

export function useDeleteQualityProfile() {
  return useMutationWithToast({
    mutationFn: (id: string) => apiClient.deleteQualityProfile(id),
    successMessage: "Quality profile deleted",
    invalidateKeys: [queryKeys.qualityProfiles.all],
    errorMessage: "Failed to delete quality profile",
  });
}

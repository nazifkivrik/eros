"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import type { QualityItem } from "@repo/shared-types";

export function useQualityProfiles() {
  return useQuery({
    queryKey: queryKeys.qualityProfiles.all,
    queryFn: async () => {
      const response = await apiClient.getQualityProfiles();
      return response;
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      items: QualityItem[];
    }) => apiClient.createQualityProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.qualityProfiles.all });
      toast.success("Quality profile created");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create quality profile");
    },
  });
}

export function useUpdateQualityProfile() {
  const queryClient = useQueryClient();

  return useMutation({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.qualityProfiles.all });
      toast.success("Quality profile updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update quality profile");
    },
  });
}

export function useDeleteQualityProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteQualityProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.qualityProfiles.all });
      toast.success("Quality profile deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete quality profile");
    },
  });
}

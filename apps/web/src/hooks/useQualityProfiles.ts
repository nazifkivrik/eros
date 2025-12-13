"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface QualityItem {
  quality: string;
  source: string;
  minSeeders: number | "any";
  maxSize: number; // in GB, 0 means unlimited
}

export interface QualityProfile {
  id: string;
  name: string;
  items: QualityItem[];
  createdAt: string;
  updatedAt: string;
}

export function useQualityProfiles() {
  return useQuery({
    queryKey: ["qualityProfiles"],
    queryFn: async () => {
      const response = await apiClient.getQualityProfiles();
      return response; // Return the whole response with { data: [...] }
    },
  });
}

export function useQualityProfile(id: string) {
  return useQuery({
    queryKey: ["qualityProfile", id],
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
      queryClient.invalidateQueries({ queryKey: ["qualityProfiles"] });
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
      queryClient.invalidateQueries({ queryKey: ["qualityProfiles"] });
    },
  });
}

export function useDeleteQualityProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteQualityProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualityProfiles"] });
    },
  });
}

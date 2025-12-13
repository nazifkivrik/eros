"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function usePerformers(limit = 20, offset = 0) {
  return useQuery({
    queryKey: ["performers", limit, offset],
    queryFn: () => apiClient.getPerformers(limit, offset),
    placeholderData: (previousData) => previousData,
  });
}

export function usePerformer(id: string) {
  return useQuery({
    queryKey: ["performer", id],
    queryFn: () => apiClient.getPerformer(id),
    enabled: !!id,
  });
}

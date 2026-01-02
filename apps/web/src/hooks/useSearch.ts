import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useSearch(query: string, limit = 20, page = 1) {
  return useQuery({
    queryKey: ["search", query, limit, page],
    queryFn: () => apiClient.search(query, limit, page),
    enabled: query.length > 0,
    placeholderData: (previousData) => previousData, // Keep previous data while loading
    staleTime: 1000, // Consider data fresh for 1 second
  });
}

export function useSearchPerformers(query: string, limit = 20) {
  return useQuery({
    queryKey: ["search", "performers", query, limit],
    queryFn: () => apiClient.searchPerformers(query, limit),
    enabled: query.length > 0,
  });
}

export function useSearchStudios(query: string, limit = 20) {
  return useQuery({
    queryKey: ["search", "studios", query, limit],
    queryFn: () => apiClient.searchStudios(query, limit),
    enabled: query.length > 0,
  });
}

export function useSearchScenes(query: string, limit = 20) {
  return useQuery({
    queryKey: ["search", "scenes", query, limit],
    queryFn: () => apiClient.searchScenes(query, limit),
    enabled: query.length > 0,
  });
}

export function usePerformerDetails(id: string) {
  return useQuery({
    queryKey: ["performer", id],
    queryFn: () => apiClient.getPerformerDetails(id),
    enabled: !!id,
  });
}

export function useStudioDetails(id: string) {
  return useQuery({
    queryKey: ["studio", id],
    queryFn: () => apiClient.getStudioDetails(id),
    enabled: !!id,
  });
}

export function useSceneDetails(id: string) {
  return useQuery({
    queryKey: ["scene", id],
    queryFn: () => apiClient.getSceneDetails(id),
    enabled: !!id,
  });
}

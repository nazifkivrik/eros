import { useQuery } from "@tanstack/react-query";

export interface StorageVolume {
  path: string;
  name: string;
  total: number;
  used: number;
  available: number;
  usagePercentage: number;
}

export interface DashboardStatistics {
  storage: {
    totalDiskSpace: number;
    usedDiskSpace: number;
    availableDiskSpace: number;
    contentSize: number;
    usagePercentage: number;
    volumes: StorageVolume[];
  };
  content: {
    totalScenes: number;
    scenesWithFiles: number;
    totalFiles: number;
    totalContentSize: number;
    topStudios: Array<{ name: string; count: number; size: number }>;
    qualityDistribution: Array<{ quality: string; count: number; size: number }>;
  };
  activeDownloads: number;
  queuedDownloads: number;
  completedDownloads: number;
  failedDownloads: number;
}

export interface ProviderStatus {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  status: "connected" | "disconnected" | "error";
}

export interface ProviderStatusResponse {
  metadataProviders: ProviderStatus[];
  indexers: ProviderStatus[];
  torrentClients: ProviderStatus[];
}

export function useDashboardStatistics() {
  return useQuery({
    queryKey: ["dashboard", "statistics"],
    queryFn: async (): Promise<DashboardStatistics> => {
      console.log("Fetching dashboard statistics from /api/dashboard/statistics");
      const response = await fetch("/api/dashboard/statistics");
      console.log("Dashboard API response status:", response.status, response.ok);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Dashboard API error:", response.status, errorText);
        throw new Error("Failed to fetch dashboard statistics");
      }
      const data = await response.json();
      console.log("Dashboard API response:", data);
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
}

export function useProviderStatus() {
  return useQuery({
    queryKey: ["dashboard", "providers", "status"],
    queryFn: async (): Promise<ProviderStatusResponse> => {
      const response = await fetch("/api/dashboard/providers/status");
      if (!response.ok) {
        throw new Error("Failed to fetch provider status");
      }
      return response.json();
    },
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 10000,
  });
}

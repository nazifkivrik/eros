import { useQuery } from "@tanstack/react-query";

export interface DashboardStatistics {
  storage: {
    totalDiskSpace: number;
    usedDiskSpace: number;
    availableDiskSpace: number;
    contentSize: number;
    usagePercentage: number;
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

import { useQuery } from "@tanstack/react-query";

export type UnifiedDownloadStatus =
  | "queued"
  | "downloading"
  | "completed"
  | "seeding"
  | "paused"
  | "failed";

export interface UnifiedDownload {
  id: string;
  sceneId: string;
  sceneTitle: string;
  scenePoster: string | null;
  sceneStudio: string | null;
  qbitHash: string | null;
  status: UnifiedDownloadStatus;
  progress: number; // 0-1
  downloadSpeed: number; // bytes/sec
  uploadSpeed: number; // bytes/sec
  eta: number; // seconds
  size: number;
  seeders: number;
  leechers: number;
  quality: string;
  priority: number | null;
  addedAt: string;
  completedAt: string | null;
}

interface UnifiedDownloadsResponse {
  downloads: UnifiedDownload[];
}

export function useUnifiedDownloads() {
  return useQuery<UnifiedDownloadsResponse>({
    queryKey: ["unified-downloads"],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const res = await fetch(`${baseUrl}/download-queue/unified`);
      if (!res.ok) {
        throw new Error("Failed to fetch unified downloads");
      }
      return res.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
    staleTime: 3000, // Consider data stale after 3 seconds
  });
}

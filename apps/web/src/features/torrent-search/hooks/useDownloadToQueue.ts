import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ManualSearchResult } from "@repo/shared-types";

export function useDownloadToQueue(sceneId: string) {
  return useMutation({
    mutationFn: (torrent: ManualSearchResult) =>
      apiClient.addToDownloadQueue({
        sceneId,
        title: torrent.title,
        size: torrent.size,
        seeders: torrent.seeders,
        quality: torrent.quality,
        magnetLink: torrent.infoHash
          ? `magnet:?xt=urn:btih:${torrent.infoHash}`
          : torrent.downloadUrl,
      }),
    onSuccess: () => {
      // Toast notification will be handled by the calling component
      return { success: true };
    },
  });
}

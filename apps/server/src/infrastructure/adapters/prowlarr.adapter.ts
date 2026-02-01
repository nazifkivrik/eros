/**
 * Prowlarr Adapter
 * Implements IIndexer interface for Prowlarr service
 */

import type {
  IIndexer,
  IndexerInfo,
  TorrentSearchResult,
  SearchOptions,
} from "./interfaces/indexer.interface.js";
import type { Logger } from "pino";

interface ProwlarrConfig {
  baseUrl: string;
  apiKey: string;
}

interface ProwlarrIndexer {
  id: number;
  name: string;
  enable: boolean;
  priority: number;
  categories: number[];
}

interface ProwlarrSearchResult {
  guid: string;
  title: string;
  indexer: string;
  indexerId: number;
  size: number;
  publishDate: string;
  downloadUrl: string;
  magnetUrl?: string;
  infoUrl?: string;
  seeders?: number;
  leechers?: number;
  protocol: "torrent" | "usenet";
  categories: number[];
}

export class ProwlarrAdapter implements IIndexer {
  readonly name = "prowlarr";
  private baseUrl: string;
  private apiKey: string;
  private logger: Logger;

  constructor(config: ProwlarrConfig, logger: Logger) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.logger = logger;
  }

  /**
   * Extract infoHash from magnet link
   * Magnet links have format: magnet:?xt=urn:btih:<INFOHASH>&dn=...
   * Handles base32 (32 chars) and hex (40 chars) infoHashes
   */
  private extractInfoHashFromMagnet(magnetUrl: string): string | null {
    // Try 40-char hex first (most common)
    let match = magnetUrl.match(/magnet:\?xt=urn:btih:([a-fA-F0-9]{40})/i);
    if (match) {
      return match[1].toUpperCase();
    }

    // Try base32 (32 chars, upper case, A-Z2-7)
    match = magnetUrl.match(/magnet:\?xt=urn:btih:([A-Z2-7]{32})/i);
    if (match) {
      return match[1].toUpperCase();
    }

    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Prowlarr API error: ${response.status} ${response.statusText}\nURL: ${url}\nResponse: ${text.substring(0, 200)}`
      );
    }

    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(
        `Prowlarr returned invalid JSON\nURL: ${url}\nResponse: ${text.substring(0, 200)}`
      );
    }
  }

  async search(query: string, options?: SearchOptions): Promise<TorrentSearchResult[]> {
    const params = new URLSearchParams({
      query,
      limit: (options?.limit || 100).toString(),
      type: "search",
    });

    if (options?.categories && options.categories.length > 0) {
      params.append("categories", options.categories.join(","));
    }

    const results = await this.request<ProwlarrSearchResult[]>(
      `/api/v1/search?${params.toString()}`
    );

    this.logger.debug({ count: results.length, query }, "Prowlarr search completed");

    // Map Prowlarr results to standard interface format
    return results.map((result) => {
      // Prowlarr returns:
      // - guid: identifier (could be magnet link, URL, or other identifier)
      // - magnetUrl: Prowlarr download proxy URL (http://localhost:9696/...)
      // We need to extract infoHash from wherever the magnet link is
      let actualInfoHash: string | null = null;
      let actualMagnetUrl: string | null = null;

      // Try to extract infoHash from guid (if it's a magnet link)
      if (result.guid && result.guid.startsWith("magnet:")) {
        const extracted = this.extractInfoHashFromMagnet(result.guid);
        if (extracted) {
          actualInfoHash = extracted;
          actualMagnetUrl = result.guid;
          this.logger.debug({
            guid: result.guid.substring(0, 50),
            extractedInfoHash: extracted,
            title: result.title,
          }, "Extracted infoHash from guid (magnet link)");
        }
      }

      // Fallback: try to extract from magnetUrl if it's a magnet link
      if (!actualInfoHash && result.magnetUrl && result.magnetUrl.startsWith("magnet:")) {
        const extracted = this.extractInfoHashFromMagnet(result.magnetUrl);
        if (extracted) {
          actualInfoHash = extracted;
          actualMagnetUrl = result.magnetUrl;
          this.logger.debug({
            magnetUrl: result.magnetUrl.substring(0, 50),
            extractedInfoHash: extracted,
            title: result.title,
          }, "Extracted infoHash from magnetUrl");
        }
      }

      // If no magnet link found, log warning
      if (!actualInfoHash) {
        this.logger.warn({
          guid: result.guid?.substring(0, 100),
          magnetUrl: result.magnetUrl?.substring(0, 100),
          title: result.title,
        }, "No valid magnet link or infoHash found in Prowlarr result");
      }

      return {
        guid: result.guid,
        title: result.title,
        size: result.size,
        seeders: result.seeders || 0,
        leechers: result.leechers || 0,
        indexerId: result.indexerId,
        indexer: result.indexer,
        downloadUrl: result.downloadUrl,
        magnetUrl: actualMagnetUrl || undefined,
        infoUrl: result.infoUrl,
        infoHash: actualInfoHash || undefined,
        publishDate: result.publishDate,
        protocol: result.protocol,
        categories: result.categories,
      };
    });
  }

  async getIndexers(): Promise<IndexerInfo[]> {
    const indexers = await this.request<ProwlarrIndexer[]>("/api/v1/indexer");

    return indexers.map((indexer) => ({
      id: indexer.id.toString(),
      name: indexer.name,
      enable: indexer.enable,
      priority: indexer.priority,
      categories: indexer.categories,
    }));
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/health`, {
        headers: {
          "X-Api-Key": this.apiKey,
        },
      });
      return response.ok;
    } catch (error) {
      this.logger.error({ error }, "Prowlarr connection test failed");
      return false;
    }
  }

  /**
   * Sync indexers from Prowlarr to our database
   * Returns indexers that should be added to the database
   */
  async syncIndexers() {
    const indexers = await this.getIndexers();

    return indexers
      .filter((indexer) => indexer.enable)
      .map((indexer) => ({
        id: `prowlarr-${indexer.id}`,
        name: indexer.name,
        type: "prowlarr" as const,
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
        priority: indexer.priority,
        enabled: true,
        categories: indexer.categories.map(String),
      }));
  }

  /**
   * Get magnet link from download URL via Prowlarr proxy
   * Prowlarr's /api/v1/download endpoint returns magnet link for torrent files
   * @param downloadUrl - The download URL to convert to magnet link
   * @param indexerId - Optional indexer ID for the request
   * @returns Magnet link URL or null if unable to convert
   */
  async getMagnetLink(downloadUrl: string, indexerId?: number): Promise<string | null> {
    try {
      // Parse the download URL to get the necessary parameters
      // Prowlarr download URLs typically look like:
      // http://prowlarr:9696/api/v1/download?indexer=123&link=...

      // If downloadUrl is already a magnet link, return it
      if (downloadUrl.startsWith("magnet:")) {
        return downloadUrl;
      }

      // Build the Prowlarr download API request
      // We need to proxy through Prowlarr to get the magnet link
      const params = new URLSearchParams();
      params.append("link", downloadUrl);
      if (indexerId) {
        params.append("indexer", indexerId.toString());
      }

      const response = await fetch(
        `${this.baseUrl}/api/v1/download?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "X-Api-Key": this.apiKey,
          },
          redirect: "manual", // Don't follow redirects, we want the response
        }
      );

      // Prowlarr will redirect to a magnet link or return the magnet content
      const location = response.headers.get("Location");
      if (location && location.startsWith("magnet:")) {
        this.logger.debug({ downloadUrl, magnetLink: location }, "Got magnet link from Prowlarr proxy");
        return location;
      }

      // If no redirect, try to read the response as magnet link
      const text = await response.text();
      if (text.startsWith("magnet:")) {
        this.logger.debug({ downloadUrl, magnetLink: text }, "Got magnet link from Prowlarr response");
        return text;
      }

      this.logger.warn(
        { downloadUrl, status: response.status },
        "Prowlarr did not return a magnet link"
      );
      return null;
    } catch (error) {
      this.logger.error({ error, downloadUrl }, "Failed to get magnet link from Prowlarr");
      return null;
    }
  }
}

/**
 * Factory function to create ProwlarrAdapter
 * @param config - Prowlarr configuration (baseUrl, apiKey)
 * @param logger - Logger instance
 * @returns Configured ProwlarrAdapter instance
 */
export function createProwlarrAdapter(config: {
  baseUrl: string;
  apiKey: string;
}, logger: Logger): ProwlarrAdapter {
  return new ProwlarrAdapter(config, logger);
}

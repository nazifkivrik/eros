/**
 * qBittorrent Adapter
 * Implements ITorrentClient interface for qBittorrent service
 */

import type {
  ITorrentClient,
  TorrentInfo,
  TorrentProperties,
  AddTorrentOptions,
} from "./interfaces/torrent-client.interface.js";
import type { Logger } from "pino";

interface QBittorrentConfig {
  url: string;
  username: string;
  password: string;
}

interface QBTorrentInfo {
  hash: string;
  name: string;
  size: number;
  progress: number;
  dlspeed: number;
  upspeed: number;
  eta: number;
  ratio: number;
  state: string;
  category: string;
  save_path: string;
  added_on: number;
  completion_on: number;
  num_seeds: number;
  num_leechs: number;
}

interface QBTorrentProperties {
  save_path: string;
  content_path: string;
  creation_date: number;
  piece_size: number;
  comment: string;
  total_wasted: number;
  total_uploaded: number;
  total_uploaded_session: number;
  total_downloaded: number;
  total_downloaded_session: number;
  up_limit: number;
  dl_limit: number;
  time_elapsed: number;
  seeding_time: number;
  nb_connections: number;
  nb_connections_limit: number;
  share_ratio: number;
}

interface QBTorrentFile {
  index: number;
  name: string;
  size: number;
  progress: number;
  priority: number;
  is_seed: boolean;
}

export class QBittorrentAdapter implements ITorrentClient {
  readonly name = "qbittorrent";
  private baseUrl: string;
  private apiBase: string;
  private username: string;
  private password: string;
  private cookie: string | null = null;
  private logger: Logger;

  constructor(config: QBittorrentConfig, logger: Logger) {
    this.baseUrl = config.url.replace(/\/$/, "");
    this.apiBase = `${this.baseUrl}/api/v2`;
    this.username = config.username;
    this.password = config.password;
    this.logger = logger;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Login if no cookie
    if (!this.cookie) {
      await this.login();
    }

    const url = `${this.apiBase}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Cookie: this.cookie!,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 403) {
        // Session expired, re-login
        await this.login();
        return this.request(endpoint, options);
      }

      if (!response.ok) {
        this.logger.error(
          {
            endpoint,
            status: response.status,
            statusText: response.statusText,
          },
          "[QBittorrent] API error response"
        );
        throw new Error(
          `qBittorrent API error: ${response.status} ${response.statusText}`
        );
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return response.json() as Promise<T>;
      }

      const text = await response.text();

      // Log for debugging setLocation endpoint
      if (endpoint.includes("setLocation")) {
        this.logger.info(
          {
            endpoint,
            result: text,
            resultLength: text.length,
            contentType,
          },
          "[QBittorrent] API response text"
        );
      }

      return text as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        this.logger.error({ endpoint }, "[QBittorrent] Request timeout");
        throw new Error(`qBittorrent API timeout: ${endpoint}`);
      }
      throw error;
    }
  }

  private async login(): Promise<void> {
    const formData = new URLSearchParams();
    formData.append("username", this.username);
    formData.append("password", this.password);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for login

    try {
      const response = await fetch(`${this.apiBase}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok || (await response.text()) !== "Ok.") {
        throw new Error("qBittorrent login failed");
      }

      const cookie = response.headers.get("set-cookie");
      if (!cookie) {
        throw new Error("No cookie received from qBittorrent");
      }

      this.cookie = cookie.split(";")[0];
      this.logger.debug("qBittorrent login successful");
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("qBittorrent login timeout");
      }
      throw error;
    }
  }

  async getTorrents(
    filter?: string,
    category?: string
  ): Promise<TorrentInfo[]> {
    const params = new URLSearchParams();
    if (filter) params.append("filter", filter);
    if (category) params.append("category", category);

    const torrents = await this.request<QBTorrentInfo[]>(
      `/torrents/info?${params.toString()}`
    );

    // Map QBittorrent format to interface format
    return torrents.map((t) => ({
      hash: t.hash,
      name: t.name,
      size: t.size,
      progress: t.progress,
      downloadSpeed: t.dlspeed,
      uploadSpeed: t.upspeed,
      eta: t.eta,
      ratio: t.ratio,
      state: t.state,
      category: t.category,
      savePath: t.save_path,
      addedOn: t.added_on,
      completionOn: t.completion_on,
      numSeeds: t.num_seeds,
      numLeechers: t.num_leechs,
    }));
  }

  async getTorrentProperties(hash: string): Promise<TorrentProperties> {
    const props = await this.request<QBTorrentProperties>(
      `/torrents/properties?hash=${hash}`
    );

    return {
      savePath: props.save_path,
      contentPath: props.content_path,
      creationDate: props.creation_date,
      pieceSize: props.piece_size,
      comment: props.comment,
      totalWasted: props.total_wasted,
      totalUploaded: props.total_uploaded,
      totalUploadedSession: props.total_uploaded_session,
      totalDownloaded: props.total_downloaded,
      totalDownloadedSession: props.total_downloaded_session,
      upLimit: props.up_limit,
      dlLimit: props.dl_limit,
      timeElapsed: props.time_elapsed,
      seedingTime: props.seeding_time,
      nbConnections: props.nb_connections,
      nbConnectionsLimit: props.nb_connections_limit,
      shareRatio: props.share_ratio,
    };
  }

  async addTorrent(options: AddTorrentOptions): Promise<boolean> {
    const formData = new URLSearchParams();

    if (options.urls) {
      formData.append("urls", options.urls.join("\n"));
    }

    if (options.magnetLinks) {
      formData.append("urls", options.magnetLinks.join("\n"));
    }

    if (options.category) {
      formData.append("category", options.category);
    }

    if (options.savePath) {
      formData.append("savepath", options.savePath);
    }

    if (options.paused !== undefined) {
      formData.append("paused", options.paused.toString());
    }

    const result = await this.request<string>("/torrents/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    return result === "Ok.";
  }

  /**
   * Add a torrent and wait for it to appear in qBittorrent, then return its hash
   * Uses incremental differential tracking:
   * - Takes snapshot BEFORE adding
   * - Takes snapshot AFTER adding
   * - Finds the difference (new hash)
   * - This works correctly for batch operations where torrents are added sequentially
   */
  async addTorrentAndGetHash(
    options: AddTorrentOptions & {
      matchInfoHash?: string;
      matchTitle?: string;
    },
    timeout: number = 15000
  ): Promise<string | null> {
    // STEP 1: Get snapshot BEFORE adding (capture current state)
    const beforeTorrents = await this.getTorrents();
    const beforeHashes = new Set(
      beforeTorrents.map((t) => t.hash.toLowerCase())
    );

    this.logger.debug(
      {
        beforeCount: beforeTorrents.length,
        matchTitle: options.matchTitle,
        category: options.category,
      },
      "addTorrentAndGetHash: captured BEFORE state"
    );

    // STEP 2: Add the torrent
    const success = await this.addTorrent(options);
    if (!success) {
      this.logger.error(
        { matchTitle: options.matchTitle },
        "addTorrentAndGetHash: addTorrent failed"
      );
      return null;
    }

    const startTime = Date.now();
    const checkInterval = 300; // Check every 300ms

    // STEP 3: Poll for new torrent by comparing BEFORE vs AFTER snapshots
    while (Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));

      // Get snapshot AFTER adding (this becomes the new baseline for next call)
      const afterTorrents = await this.getTorrents();
      const afterHashes = new Set(
        afterTorrents.map((t) => t.hash.toLowerCase())
      );
      const elapsed = Date.now() - startTime;

      // Find the difference: hashes in AFTER but not in BEFORE
      const newHashes: string[] = [];
      for (const torrent of afterTorrents) {
        const hash = torrent.hash.toLowerCase();
        // This hash exists in AFTER but not in BEFORE = newly added
        if (!beforeHashes.has(hash)) {
          newHashes.push(torrent.hash);

          this.logger.info(
            {
              newHash: torrent.hash,
              newTorrentName: torrent.name,
              category: torrent.category,
              beforeCount: beforeHashes.size,
              afterCount: afterHashes.size,
              elapsed,
            },
            "addTorrentAndGetHash: detected new torrent (differential)"
          );
        }
      }

      // Try to identify which new hash is ours
      for (const newHash of newHashes) {
        const newTorrent = afterTorrents.find((t) => t.hash === newHash);
        if (!newTorrent) continue;

        // Priority 1: Exact infoHash match (most reliable)
        if (options.matchInfoHash) {
          const normalizedInfoHash = options.matchInfoHash.toLowerCase();
          if (newHash.toLowerCase() === normalizedInfoHash) {
            this.logger.info(
              {
                matchInfoHash: options.matchInfoHash,
                foundHash: newTorrent.hash,
                elapsed,
              },
              "addTorrentAndGetHash: matched by infoHash"
            );
            return newTorrent.hash;
          }
        }

        // Priority 2: Category match (if specified)
        if (options.category && newTorrent.category === options.category) {
          this.logger.info(
            {
              matchTitle: options.matchTitle,
              foundHash: newTorrent.hash,
              foundName: newTorrent.name,
              category: newTorrent.category,
              elapsed,
              reason: "new torrent in target category",
            },
            "addTorrentAndGetHash: matched by category"
          );
          return newTorrent.hash;
        }

        // Priority 3: Only one new torrent appeared
        if (newHashes.length === 1) {
          this.logger.info(
            {
              matchTitle: options.matchTitle,
              foundHash: newTorrent.hash,
              foundName: newTorrent.name,
              elapsed,
              reason: "sole new torrent",
            },
            "addTorrentAndGetHash: matched (single new torrent)"
          );
          return newTorrent.hash;
        }
      }

      // Priority 4: Multiple new torrents, try title matching
      if (newHashes.length > 1 && options.matchTitle) {
        const matchTitleLower = options.matchTitle.toLowerCase();

        for (const newHash of newHashes) {
          const newTorrent = afterTorrents.find((t) => t.hash === newHash);
          if (newTorrent) {
            const torrentNameLower = newTorrent.name.toLowerCase();

            if (
              torrentNameLower.includes(matchTitleLower) ||
              matchTitleLower.includes(torrentNameLower)
            ) {
              this.logger.info(
                {
                  matchTitle: options.matchTitle,
                  foundHash: newTorrent.hash,
                  foundName: newTorrent.name,
                  elapsed,
                  reason: "title match among new torrents",
                },
                "addTorrentAndGetHash: matched by title"
              );
              return newTorrent.hash;
            }
          }
        }
      }

      this.logger.debug(
        {
          elapsed,
          beforeCount: beforeHashes.size,
          afterCount: afterHashes.size,
          newHashesCount: newHashes.length,
          matchTitle: options.matchTitle,
        },
        "addTorrentAndGetHash: waiting for new torrent"
      );
    }

    // Timeout reached
    this.logger.warn(
      {
        matchTitle: options.matchTitle,
        matchInfoHash: options.matchInfoHash,
        category: options.category,
        timeout,
        elapsed: Date.now() - startTime,
        beforeCount: beforeHashes.size,
      },
      "addTorrentAndGetHash: hash lookup timed out"
    );
    return null;
  }

  async pauseTorrent(hash: string): Promise<boolean> {
    const formData = new URLSearchParams();
    formData.append("hashes", hash);

    const result = await this.request<string>("/torrents/pause", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    return result === "Ok.";
  }

  async resumeTorrent(hash: string): Promise<boolean> {
    const formData = new URLSearchParams();
    formData.append("hashes", hash);

    const result = await this.request<string>("/torrents/resume", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    return result === "Ok.";
  }

  async removeTorrent(hash: string, deleteFiles?: boolean): Promise<boolean> {
    const formData = new URLSearchParams();
    formData.append("hashes", hash);
    formData.append("deleteFiles", (deleteFiles ?? false).toString());

    const result = await this.request<string>("/torrents/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    return result === "Ok.";
  }

  async setSpeedLimit(
    hash: string,
    downloadLimit?: number,
    uploadLimit?: number
  ): Promise<boolean> {
    const formData = new URLSearchParams();
    formData.append("hashes", hash);

    if (downloadLimit !== undefined) {
      formData.append("limit", downloadLimit.toString());
      await this.request<string>("/torrents/setDownloadLimit", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });
    }

    if (uploadLimit !== undefined) {
      formData.set("limit", uploadLimit.toString());
      await this.request<string>("/torrents/setUploadLimit", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });
    }

    return true;
  }

  async setTorrentPriority(
    hash: string,
    priority: "top" | "bottom" | number
  ): Promise<boolean> {
    const formData = new URLSearchParams();
    formData.append("hashes", hash);

    if (priority === "top") {
      // qBittorrent uses priority: 1 = top, 7 = bottom
      formData.append("id", "1");
      const result = await this.request<string>("/torrents/setPriority", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });
      return result === "Ok.";
    } else if (priority === "bottom") {
      formData.append("id", "7");
      const result = await this.request<string>("/torrents/setPriority", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });
      return result === "Ok.";
    } else {
      // Priority is a number, map to qBittorrent's range (1-7)
      const qbPriority = Math.max(1, Math.min(7, Math.round(priority)));
      formData.append("id", qbPriority.toString());
      const result = await this.request<string>("/torrents/setPriority", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });
      return result === "Ok.";
    }
  }

  async deleteTorrent(hash: string, deleteFiles?: boolean): Promise<boolean> {
    // Alias for removeTorrent
    return this.removeTorrent(hash, deleteFiles);
  }

  /**
   * Set global download/upload speed limits
   */
  async setGlobalSpeedLimits(
    downloadLimit?: number,
    uploadLimit?: number
  ): Promise<boolean> {
    if (downloadLimit !== undefined) {
      const formData = new URLSearchParams();
      // Set download limit (0 = unlimited)
      formData.append("limit", downloadLimit.toString());
      await this.request<string>("/transfer/setDownloadLimit", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });
    }

    if (uploadLimit !== undefined) {
      const formData = new URLSearchParams();
      // Set upload limit (0 = unlimited)
      formData.append("limit", uploadLimit.toString());
      await this.request<string>("/transfer/setUploadLimit", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });
    }

    return true;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.login();
      return true;
    } catch (error) {
      this.logger.error({ error }, "qBittorrent connection test failed");
      return false;
    }
  }

  /**
   * Set torrent location (move files via qBittorrent)
   * Note: setLocation returns empty string on success (HTTP 200), not "Ok."
   */
  async setLocation(hash: string, location: string): Promise<boolean> {
    this.logger.info(
      {
        hash,
        location,
        apiEndpoint: "/torrents/setLocation",
      },
      "[QBittorrent] setLocation API call"
    );

    const formData = new URLSearchParams();
    formData.append("hashes", hash);
    formData.append("location", location);

    this.logger.debug(
      {
        formDataBody: formData.toString(),
      },
      "[QBittorrent] Request body"
    );

    try {
      const result = await this.request<string>("/torrents/setLocation", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      // setLocation returns empty string on success (HTTP 200 with no body)
      // If we get here without throwing, it means HTTP 200 was returned
      const success = true;
      this.logger.info(
        {
          hash,
          location,
          result,
          resultLength: result.length,
          success,
        },
        "[QBittorrent] setLocation API response"
      );

      return success;
    } catch (error) {
      this.logger.error(
        {
          error,
          hash,
          location,
        },
        "[QBittorrent] setLocation API error"
      );
      throw error;
    }
  }

  /**
   * Get torrent info (alias for getting a single torrent's info)
   */
  async getTorrentInfo(hash: string): Promise<TorrentInfo | null> {
    const torrents = await this.getTorrents();
    return torrents.find((t) => t.hash === hash) || null;
  }

  /**
   * Add a magnet link directly
   */
  async addMagnet(magnetLink: string): Promise<string | null> {
    return this.addTorrentAndGetHash({
      magnetLinks: [magnetLink],
    });
  }

  /**
   * Get files in a torrent
   */
  async getTorrentFiles(hash: string): Promise<QBTorrentFile[]> {
    return this.request<QBTorrentFile[]>(`/torrents/files?hash=${hash}`);
  }

  /**
   * Get categories from qBittorrent
   */
  async getCategories(): Promise<
    Record<string, { name: string; savePath: string }>
  > {
    return this.request<Record<string, { name: string; savePath: string }>>(
      "/torrents/categories"
    );
  }

  /**
   * Create a category in qBittorrent
   */
  async createCategory(name: string, savePath: string): Promise<boolean> {
    const formData = new URLSearchParams();
    formData.append("category", name);
    formData.append("savePath", savePath);

    const result = await this.request<string>("/torrents/createCategory", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    return result === "Ok.";
  }
}

/**
 * Factory function to create QBittorrentAdapter
 */
export function createQBittorrentAdapter(
  config: {
    url: string;
    username: string;
    password: string;
  },
  logger: Logger
): QBittorrentAdapter {
  return new QBittorrentAdapter(config, logger);
}

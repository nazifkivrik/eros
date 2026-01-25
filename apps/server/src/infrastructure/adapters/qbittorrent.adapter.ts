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
  private username: string;
  private password: string;
  private cookie: string | null = null;
  private logger: Logger;

  constructor(config: QBittorrentConfig, logger: Logger) {
    this.baseUrl = config.url.replace(/\/$/, "");
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

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Cookie: this.cookie!,
        ...options.headers,
      },
    });

    if (response.status === 403) {
      // Session expired, re-login
      await this.login();
      return this.request(endpoint, options);
    }

    if (!response.ok) {
      throw new Error(
        `qBittorrent API error: ${response.status} ${response.statusText}`
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json() as Promise<T>;
    }

    return response.text() as Promise<T>;
  }

  private async login(): Promise<void> {
    const formData = new URLSearchParams();
    formData.append("username", this.username);
    formData.append("password", this.password);

    const response = await fetch(`${this.baseUrl}/api/v2/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    if (!response.ok || (await response.text()) !== "Ok.") {
      throw new Error("qBittorrent login failed");
    }

    const cookie = response.headers.get("set-cookie");
    if (!cookie) {
      throw new Error("No cookie received from qBittorrent");
    }

    this.cookie = cookie.split(";")[0];
    this.logger.debug("qBittorrent login successful");
  }

  async getTorrents(filter?: string, category?: string): Promise<TorrentInfo[]> {
    const params = new URLSearchParams();
    if (filter) params.append("filter", filter);
    if (category) params.append("category", category);

    const torrents = await this.request<QBTorrentInfo[]>(
      `/api/v2/torrents/info?${params.toString()}`
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
      `/api/v2/torrents/properties?hash=${hash}`
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

    const result = await this.request<string>("/api/v2/torrents/add", {
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
   */
  async addTorrentAndGetHash(
    options: AddTorrentOptions & {
      matchInfoHash?: string;
      matchTitle?: string;
    },
    timeout: number = 10000
  ): Promise<string | null> {
    // First add the torrent
    const success = await this.addTorrent(options);
    if (!success) {
      return null;
    }

    const startTime = Date.now();
    const checkInterval = 500; // Check every 500ms

    while (Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));

      // Get torrents from qBittorrent
      const torrents = await this.getTorrents();

      // Try to match by infoHash (fastest and most reliable)
      if (options.matchInfoHash) {
        const normalizedInfoHash = options.matchInfoHash.toLowerCase();
        const found = torrents.find((t) => t.hash.toLowerCase() === normalizedInfoHash);
        if (found) {
          return found.hash;
        }
      }

      // Try to match by title (slower, but works if infoHash isn't available)
      if (options.matchTitle) {
        const found = torrents.find((t) => t.name === options.matchTitle);
        if (found) {
          return found.hash;
        }
      }

      // If we have both infoHash and title, also try to match by recently added
      // with matching title and category
      if (options.category) {
        const now = Math.floor(Date.now() / 1000);
        const recentlyAdded = torrents.filter(
          (t) =>
            t.category === options.category &&
            (now - t.addedOn) < 30 // Added within last 30 seconds
        );

        if (recentlyAdded.length === 1 && options.matchTitle) {
          // Only one recent torrent in this category, assume it's ours
          const found = recentlyAdded.find((t) => t.name === options.matchTitle);
          if (found) {
            return found.hash;
          }
        }
      }
    }

    // Timeout reached
    this.logger.warn({ matchTitle: options.matchTitle }, "Torrent hash lookup timed out");
    return null;
  }

  async pauseTorrent(hash: string): Promise<boolean> {
    const formData = new URLSearchParams();
    formData.append("hashes", hash);

    const result = await this.request<string>("/api/v2/torrents/pause", {
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

    const result = await this.request<string>("/api/v2/torrents/resume", {
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

    const result = await this.request<string>("/api/v2/torrents/delete", {
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
      await this.request<string>("/api/v2/torrents/setDownloadLimit", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });
    }

    if (uploadLimit !== undefined) {
      formData.set("limit", uploadLimit.toString());
      await this.request<string>("/api/v2/torrents/setUploadLimit", {
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
      const result = await this.request<string>("/api/v2/torrents/setPriority", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });
      return result === "Ok.";
    } else if (priority === "bottom") {
      formData.append("id", "7");
      const result = await this.request<string>("/api/v2/torrents/setPriority", {
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
      const result = await this.request<string>("/api/v2/torrents/setPriority", {
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
      await this.request<string>("/api/v2/transfer/setDownloadLimit", {
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
      await this.request<string>("/api/v2/transfer/setUploadLimit", {
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
   */
  async setLocation(hash: string, location: string): Promise<boolean> {
    const formData = new URLSearchParams();
    formData.append("hashes", hash);
    formData.append("location", location);

    const result = await this.request<string>("/api/v2/torrents/setLocation", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    return result === "Ok.";
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
    return this.request<QBTorrentFile[]>(`/api/v2/torrents/files?hash=${hash}`);
  }

  /**
   * Get categories from qBittorrent
   */
  async getCategories(): Promise<
    Record<string, { name: string; savePath: string }>
  > {
    return this.request<Record<string, { name: string; savePath: string }>>(
      "/api/v2/torrents/categories"
    );
  }

  /**
   * Create a category in qBittorrent
   */
  async createCategory(name: string, savePath: string): Promise<boolean> {
    const formData = new URLSearchParams();
    formData.append("category", name);
    formData.append("savePath", savePath);

    const result = await this.request<string>(
      "/api/v2/torrents/createCategory",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      }
    );

    return result === "Ok.";
  }
}

/**
 * Factory function to create QBittorrentAdapter
 */
export function createQBittorrentAdapter(config: {
  url: string;
  username: string;
  password: string;
}, logger: Logger): QBittorrentAdapter {
  return new QBittorrentAdapter(config, logger);
}

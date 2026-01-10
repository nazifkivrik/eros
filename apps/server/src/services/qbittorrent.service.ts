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

export class QBittorrentService {
  private baseUrl: string;
  private username: string;
  private password: string;
  private cookie: string | null = null;

  constructor(config: QBittorrentConfig) {
    this.baseUrl = config.url.replace(/\/$/, "");
    this.username = config.username;
    this.password = config.password;
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
  }

  async getTorrents(
    filter?: string,
    category?: string
  ): Promise<QBTorrentInfo[]> {
    const params = new URLSearchParams();
    if (filter) params.append("filter", filter);
    if (category) params.append("category", category);

    return this.request<QBTorrentInfo[]>(
      `/api/v2/torrents/info?${params.toString()}`
    );
  }

  async getTorrentProperties(hash: string): Promise<QBTorrentProperties> {
    return this.request<QBTorrentProperties>(
      `/api/v2/torrents/properties?hash=${hash}`
    );
  }

  async addTorrent(options: {
    urls?: string[];
    magnetLinks?: string[];
    category?: string;
    savePath?: string;
    paused?: boolean;
  }): Promise<boolean> {
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
   * This is useful for immediately storing the qBittorrent hash in the database
   *
   * @param options - Same as addTorrent options
   * @param options.matchInfoHash - Optional infoHash to match against (for faster lookup)
   * @param options.matchTitle - Optional title to match against (fallback)
   * @param timeout - Maximum time to wait for torrent to appear (default: 10 seconds)
   * @returns The qBittorrent hash, or null if not found within timeout
   */
  async addTorrentAndGetHash(
    options: {
      urls?: string[];
      magnetLinks?: string[];
      category?: string;
      savePath?: string;
      paused?: boolean;
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
            (now - t.added_on) < 30 // Added within last 30 seconds
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

  async removeTorrent(hash: string, deleteFiles = false): Promise<boolean> {
    const formData = new URLSearchParams();
    formData.append("hashes", hash);
    formData.append("deleteFiles", deleteFiles.toString());

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
    priority: "increase" | "decrease" | "top" | "bottom"
  ): Promise<boolean> {
    const formData = new URLSearchParams();
    formData.append("hashes", hash);

    const endpoints: Record<typeof priority, string> = {
      increase: "/api/v2/torrents/increasePrio",
      decrease: "/api/v2/torrents/decreasePrio",
      top: "/api/v2/torrents/topPrio",
      bottom: "/api/v2/torrents/bottomPrio",
    };

    const result = await this.request<string>(endpoints[priority], {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    return result === "Ok.";
  }

  /**
   * Set torrent location (move files via qBittorrent)
   * This preserves seeding by letting qBittorrent track the move
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
   * Rename torrent (changes display name in qBittorrent)
   */
  async renameTorrent(hash: string, newName: string): Promise<boolean> {
    const formData = new URLSearchParams();
    formData.append("hash", hash);
    formData.append("name", newName);

    const result = await this.request<string>("/api/v2/torrents/rename", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    return result === "Ok.";
  }

  /**
   * Get files in a torrent
   */
  async getTorrentFiles(hash: string): Promise<QBTorrentFile[]> {
    return this.request<QBTorrentFile[]>(`/api/v2/torrents/files?hash=${hash}`);
  }

  async getCategories(): Promise<
    Record<string, { name: string; savePath: string }>
  > {
    return this.request<Record<string, { name: string; savePath: string }>>(
      "/api/v2/torrents/categories"
    );
  }

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

  async setGlobalSpeedLimits(
    downloadLimit: number,
    uploadLimit: number
  ): Promise<boolean> {
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

    // Set upload limit (0 = unlimited)
    formData.set("limit", uploadLimit.toString());
    await this.request<string>("/api/v2/transfer/setUploadLimit", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    return true;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.login();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Maps qBittorrent torrent info to our internal format
   */
  mapTorrentInfo(torrent: QBTorrentInfo) {
    return {
      hash: torrent.hash,
      name: torrent.name,
      size: torrent.size,
      progress: torrent.progress,
      downloadSpeed: torrent.dlspeed,
      uploadSpeed: torrent.upspeed,
      eta: torrent.eta,
      ratio: torrent.ratio,
      state: torrent.state,
      category: torrent.category,
      savePath: torrent.save_path,
      addedOn: torrent.added_on,
      completionOn: torrent.completion_on,
      seeders: torrent.num_seeds,
      leechers: torrent.num_leechs,
    };
  }
}

export function createQBittorrentService(config: QBittorrentConfig) {
  return new QBittorrentService(config);
}

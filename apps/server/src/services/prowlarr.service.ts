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

export class ProwlarrService {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ProwlarrConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
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
      throw new Error(
        `Prowlarr API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<T>;
  }

  async getIndexers(): Promise<ProwlarrIndexer[]> {
    return this.request<ProwlarrIndexer[]>("/api/v1/indexer");
  }

  async searchIndexers(
    query: string,
    categories?: number[],
    limit = 100
  ): Promise<ProwlarrSearchResult[]> {
    const params = new URLSearchParams({
      query,
      limit: limit.toString(),
      type: "search",
    });

    if (categories && categories.length > 0) {
      params.append("categories", categories.join(","));
    }

    const results = await this.request<ProwlarrSearchResult[]>(
      `/api/v1/search?${params.toString()}`
    );

    return results;
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
      return false;
    }
  }

  /**
   * Maps Prowlarr search results to our internal format
   */
  mapSearchResults(results: ProwlarrSearchResult[]) {
    return results.map((result) => ({
      guid: result.guid,
      title: result.title,
      indexer: result.indexer,
      indexerId: result.indexerId,
      size: result.size,
      publishDate: result.publishDate,
      downloadUrl: result.magnetUrl || result.downloadUrl,
      infoUrl: result.infoUrl,
      seeders: result.seeders || 0,
      leechers: result.leechers || 0,
      protocol: result.protocol,
      categories: result.categories,
    }));
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
}

export function createProwlarrService(config: ProwlarrConfig) {
  return new ProwlarrService(config);
}

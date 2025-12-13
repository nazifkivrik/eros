const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const { params, ...fetchOptions } = options;

    let url = `${this.baseUrl}${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        // Skip undefined, null, and empty string values
        if (value !== undefined && value !== null && value !== "") {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    // Only add Content-Type header if there's a body
    const headers: Record<string, string> = {
      ...(fetchOptions.headers as Record<string, string> || {}),
    };
    
    if (fetchOptions.body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: "An error occurred",
      }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(password: string) {
    return this.request<{ success: boolean; message: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  }

  async logout() {
    return this.request<{ success: boolean; message: string }>(
      "/auth/logout",
      {
        method: "POST",
      }
    );
  }

  async getAuthStatus() {
    return this.request<{ authenticated: boolean; userId: string | null }>(
      "/auth/status"
    );
  }

  // Search
  async search(query: string, limit = 20) {
    return this.request<{
      performers: any[];
      studios: any[];
      scenes: any[];
    }>("/search", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    });
  }

  async searchPerformers(query: string, limit = 20) {
    return this.request<{ results: any[] }>("/search/performers", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    });
  }

  async searchStudios(query: string, limit = 20) {
    return this.request<{ results: any[] }>("/search/studios", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    });
  }

  async searchScenes(query: string, limit = 20) {
    return this.request<{ results: any[] }>("/search/scenes", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    });
  }

  async getPerformerDetails(id: string) {
    return this.request<any>(`/search/performers/${id}`);
  }

  async getStudioDetails(id: string) {
    return this.request<any>(`/search/studios/${id}`);
  }

  async getSceneDetails(id: string) {
    return this.request<any>(`/search/scenes/${id}`);
  }

  // Performers
  async getPerformers(limit = 20, offset = 0) {
    return this.request<{ data: any[]; total: number }>("/performers", {
      params: { limit, offset },
    });
  }

  async getPerformer(id: string) {
    return this.request<any>(`/performers/${id}`);
  }

  // Quality Profiles
  async getQualityProfiles() {
    return this.request<{ data: any[] }>("/quality-profiles");
  }

  async getQualityProfile(id: string) {
    return this.request<any>(`/quality-profiles/${id}`);
  }

  async createQualityProfile(data: {
    name: string;
    items: Array<{
      quality: string;
      source: string;
      minSeeders: number | "any";
      maxSize: number;
    }>;
  }) {
    return this.request<any>("/quality-profiles", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateQualityProfile(
    id: string,
    data: {
      name: string;
      items: Array<{
        quality: string;
        source: string;
        minSeeders: number | "any";
        maxSize: number;
      }>;
    }
  ) {
    return this.request<any>(`/quality-profiles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteQualityProfile(id: string) {
    return this.request<{ success: boolean }>(`/quality-profiles/${id}`, {
      method: "DELETE",
    });
  }

  // Subscriptions
  async createSubscription(data: {
    entityType: "performer" | "studio" | "scene";
    entityId: string;
    qualityProfileId: string;
    autoDownload: boolean;
    includeMetadataMissing: boolean;
    includeAliases: boolean;
  }) {
    return this.request<any>("/subscriptions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async subscribeToPerformer(
    performerId: string,
    settings: {
      qualityProfileId: string;
      autoDownload: boolean;
      includeMetadataMissing: boolean;
      includeAliases: boolean;
    }
  ) {
    return this.createSubscription({
      entityType: "performer",
      entityId: performerId,
      ...settings,
    });
  }

  async subscribeToStudio(
    studioId: string,
    settings: {
      qualityProfileId: string;
      autoDownload: boolean;
      includeMetadataMissing: boolean;
      includeAliases: boolean;
    }
  ) {
    return this.createSubscription({
      entityType: "studio",
      entityId: studioId,
      ...settings,
    });
  }

  async subscribeToScene(
    sceneId: string,
    settings: {
      qualityProfileId: string;
      autoDownload: boolean;
      includeMetadataMissing: boolean;
      includeAliases: boolean;
    }
  ) {
    return this.createSubscription({
      entityType: "scene",
      entityId: sceneId,
      ...settings,
    });
  }

  async getSubscriptions() {
    return this.request<{ data: any[] }>("/subscriptions");
  }

  async getSubscription(id: string) {
    return this.request<any>(`/subscriptions/${id}`);
  }

  async checkSubscription(entityType: string, entityId: string) {
    return this.request<{ subscribed: boolean; subscription: any | null }>(
      `/subscriptions/check/${entityType}/${entityId}`
    );
  }

  async deleteSubscription(id: string, deleteAssociatedScenes: boolean = false) {
    return this.request<{ success: boolean }>(`/subscriptions/${id}`, {
      method: "DELETE",
      params: { deleteAssociatedScenes },
    });
  }

  // Download Queue
  async getDownloadQueue() {
    const response = await this.request<{ data: any[] }>("/download-queue");
    return {
      items: response.data,
      total: response.data.length
    };
  }

  async pauseDownload(id: string) {
    return this.request<{ success: boolean; message: string }>(
      `/download-queue/${id}/pause`,
      { method: "POST" }
    );
  }

  async resumeDownload(id: string) {
    return this.request<{ success: boolean; message: string }>(
      `/download-queue/${id}/resume`,
      { method: "POST" }
    );
  }

  async removeDownload(id: string) {
    return this.request<{ success: boolean; message: string }>(
      `/download-queue/${id}`,
      { method: "DELETE" }
    );
  }

  // Torrents
  async getTorrents() {
    return this.request<{ torrents: any[]; total: number }>("/torrents");
  }

  async pauseTorrent(hash: string) {
    return this.request<{ success: boolean; message: string }>(
      `/torrents/${hash}/pause`,
      { method: "POST" }
    );
  }

  async resumeTorrent(hash: string) {
    return this.request<{ success: boolean; message: string }>(
      `/torrents/${hash}/resume`,
      { method: "POST" }
    );
  }

  async removeTorrent(hash: string, deleteFiles = false) {
    return this.request<{ success: boolean; message: string }>(
      `/torrents/${hash}${deleteFiles ? "?deleteFiles=true" : ""}`,
      { method: "DELETE" }
    );
  }

  async setTorrentPriority(
    hash: string,
    priority: "top" | "bottom" | "increase" | "decrease"
  ) {
    return this.request<{ success: boolean; message: string }>(
      `/torrents/${hash}/priority`,
      {
        method: "PATCH",
        body: JSON.stringify({ priority }),
      }
    );
  }

  // Jobs
  async getJobs() {
    return this.request<{ jobs: any[] }>("/jobs");
  }

  async triggerJob(jobName: string) {
    return this.request<{ success: boolean; message: string }>(
      `/jobs/${jobName}/trigger`,
      { method: "POST" }
    );
  }

  // Logs
  async getLogs(filters?: {
    level?: "error" | "warning" | "info" | "debug";
    eventType?: "torrent" | "subscription" | "download" | "metadata" | "system";
    sceneId?: string;
    performerId?: string;
    studioId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.request<{
      data: Array<{
        id: string;
        level: string;
        eventType: string;
        message: string;
        details: Record<string, unknown> | null;
        sceneId: string | null;
        performerId: string | null;
        studioId: string | null;
        createdAt: string;
      }>;
      total: number;
    }>("/logs", {
      params: filters as Record<string, string | number | boolean>,
    });
  }

  async getLog(id: string) {
    return this.request<{
      id: string;
      level: string;
      eventType: string;
      message: string;
      details: Record<string, unknown> | null;
      sceneId: string | null;
      performerId: string | null;
      studioId: string | null;
      createdAt: string;
    }>(`/logs/${id}`);
  }

  async cleanupLogs(daysToKeep: number = 30) {
    return this.request<{ deletedCount: number }>("/logs/cleanup", {
      method: "DELETE",
      params: { daysToKeep },
    });
  }

  // Settings
  async getSettings() {
    return this.request<{
      general: {
        appName: string;
        downloadPath: string;
        enableNotifications: boolean;
        minIndexersForMetadataLess: number;
      };
      stashdb: {
        apiUrl: string;
        apiKey: string;
        enabled: boolean;
      };
      prowlarr: {
        apiUrl: string;
        apiKey: string;
        enabled: boolean;
      };
      qbittorrent: {
        url: string;
        username: string;
        password: string;
        enabled: boolean;
      };
      ai: {
        enabled: boolean;
        model: string;
        threshold: number;
      };
    }>("/settings");
  }

  async updateSettings(settings: {
    general: {
      appName: string;
      downloadPath: string;
      enableNotifications: boolean;
      minIndexersForMetadataLess: number;
    };
    stashdb: {
      apiUrl: string;
      apiKey: string;
      enabled: boolean;
    };
    prowlarr: {
      apiUrl: string;
      apiKey: string;
      enabled: boolean;
    };
    qbittorrent: {
      url: string;
      username: string;
      password: string;
      enabled: boolean;
    };
    ai: {
      enabled: boolean;
      model: string;
      threshold: number;
    };
  }) {
    return this.request<typeof settings>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  async testServiceConnection(service: "stashdb" | "prowlarr" | "qbittorrent") {
    return this.request<{ success: boolean; message: string }>(
      `/settings/test/${service}`,
      { method: "POST" }
    );
  }
}

export const apiClient = new ApiClient(API_URL);

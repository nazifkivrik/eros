import type {
  Performer,
  Studio,
  Scene,
  QualityProfile,
  DownloadQueueItem,
  Subscription,
  SubscriptionDetail,
  EventType,
  LogLevel,
  AppSettings,
} from "@repo/shared-types";

// Use relative URL for browser requests to work in any environment (local, Docker, etc.)
// Server-side requests will use the full URL from env
const API_URL = typeof window === 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api")
  : "/api"; // Browser: relative URL to same origin

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

  // Setup
  async getSetupStatus() {
    return this.request<{ setupCompleted: boolean; hasAdmin: boolean }>(
      "/setup/status"
    );
  }

  async completeSetup(data: {
    username: string;
    password: string;
    settings?: {
      qbittorrent?: {
        url: string;
        username: string;
        password: string;
        enabled: boolean;
      };
      prowlarr?: {
        apiUrl: string;
        apiKey: string;
        enabled: boolean;
      };
      stashdb?: {
        apiUrl: string;
        apiKey: string;
        enabled: boolean;
      };
    };
  }) {
    return this.request<{ setupCompleted: boolean; hasAdmin: boolean }>(
      "/setup",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  }

  // Auth
  async login(username: string, password: string) {
    return this.request<{ success: boolean; message: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
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
  async search(query: string, limit = 20, page = 1) {
    return this.request<{
      performers: Performer[];
      studios: Studio[];
      scenes: Scene[];
    }>("/search", {
      method: "POST",
      body: JSON.stringify({ query, limit, page }),
    });
  }

  async searchPerformers(query: string, limit = 20) {
    return this.request<{ results: Performer[] }>("/search/performers", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    });
  }

  async searchStudios(query: string, limit = 20) {
    return this.request<{ results: Studio[] }>("/search/studios", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    });
  }

  async searchScenes(query: string, limit = 20) {
    return this.request<{ results: Scene[] }>("/search/scenes", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    });
  }

  async getPerformerDetails(id: string) {
    return this.request<Performer>(`/search/performers/${id}`);
  }

  async getStudioDetails(id: string) {
    return this.request<Studio>(`/search/studios/${id}`);
  }

  async getSceneDetails(id: string) {
    return this.request<Scene>(`/search/scenes/${id}`);
  }

  // Performers
  async getPerformers(limit = 20, offset = 0) {
    return this.request<{ data: Performer[]; total: number }>("/performers", {
      params: { limit, offset },
    });
  }

  async getPerformer(id: string) {
    return this.request<Performer>(`/performers/${id}`);
  }

  // Quality Profiles
  async getQualityProfiles() {
    return this.request<{ data: QualityProfile[] }>("/quality-profiles");
  }

  async getQualityProfile(id: string) {
    return this.request<QualityProfile>(`/quality-profiles/${id}`);
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
    return this.request<QualityProfile>("/quality-profiles", {
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
    return this.request<QualityProfile>(`/quality-profiles/${id}`, {
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
    return this.request<Subscription>("/subscriptions", {
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

  async getSubscriptions(params?: {
    search?: string;
    includeMetaless?: boolean;
    showInactive?: boolean;
  }) {
    return this.request<{ data: SubscriptionDetail[] }>("/subscriptions", {
      params: params as Record<string, string | number | boolean>,
    });
  }

  async getSubscription(id: string) {
    return this.request<SubscriptionDetail>(`/subscriptions/${id}`);
  }

  async checkSubscription(entityType: string, entityId: string) {
    return this.request<{ subscribed: boolean; subscription: Subscription | null }>(
      `/subscriptions/check/${entityType}/${entityId}`
    );
  }

  async updateSubscription(id: string, data: {
    qualityProfileId?: string;
    autoDownload?: boolean;
    includeMetadataMissing?: boolean;
    includeAliases?: boolean;
    isSubscribed?: boolean;
  }) {
    return this.request<Subscription>(`/subscriptions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteSubscription(
    id: string,
    deleteAssociatedScenes: boolean = false
  ) {
    return this.request<{ success: boolean }>(`/subscriptions/${id}`, {
      method: "DELETE",
      params: { deleteAssociatedScenes },
    });
  }

  // Download Queue
  async getDownloadQueue() {
    const response = await this.request<{ data: DownloadQueueItem[] }>("/download-queue");
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
    return this.request<{
      torrents: Array<{
        hash: string;
        name: string;
        size: number;
        progress: number;
        state: string;
        dlspeed: number;
        upspeed: number;
        downloaded: number;
        uploaded: number;
        ratio: number;
        eta: number;
        seeders: number;
        leechers: number;
        category: string;
        added_on: number;
        completion_on: number;
      }>;
      total: number
    }>("/torrents");
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
    return this.request<{
      jobs: Array<{
        id: string;
        name: string;
        description: string;
        schedule: string;
        lastRun: string | null;
        nextRun: string;
        status: string;
        enabled: boolean;
        error: string | null;
        completedAt: string | null;
        duration: number | null;
      }>
    }>("/jobs");
  }

  async triggerJob(jobName: string) {
    return this.request<{ success: boolean; message: string }>(
      `/jobs/${jobName}/trigger`,
      { method: "POST" }
    );
  }

  // Logs
  async getLogs(filters?: {
    level?: LogLevel;
    eventType?: EventType;
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
  async getSettings(): Promise<AppSettings> {
    return this.request<AppSettings>("/settings");
  }

  async updateSettings(settings: AppSettings) {
    return this.request<AppSettings>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  async testServiceConnection(
    service: "stashdb" | "tpdb" | "prowlarr" | "qbittorrent",
    config?: { apiUrl: string; apiKey: string }
  ) {
    return this.request<{ success: boolean; message: string }>(
      `/settings/test/${service}`,
      {
        method: "POST",
        body: config ? JSON.stringify(config) : undefined
      }
    );
  }

  async getAIModelStatus() {
    return this.request<{
      enabled: boolean;
      modelLoaded: boolean;
      modelDownloaded: boolean;
      modelName: string;
      modelPath: string;
      error: string | null;
    }>("/settings/ai/status");
  }

  async loadAIModel() {
    return this.request<{
      success: boolean;
      message: string;
      modelLoaded: boolean;
    }>("/settings/ai/load", {
      method: "POST",
    });
  }

  async getQBittorrentStatus() {
    return this.request<{
      connected: boolean;
      torrentsCount?: number;
      downloadSpeed?: number;
      uploadSpeed?: number;
      error?: string;
    }>("/settings/qbittorrent/status");
  }
}

export const apiClient = new ApiClient(API_URL);

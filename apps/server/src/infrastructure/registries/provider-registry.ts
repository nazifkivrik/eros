/**
 * Provider Registry
 * Manages multiple provider instances with failure tracking and circuit breaker
 */

import type { Logger } from "pino";
import type { IMetadataProvider } from "@/infrastructure/adapters/interfaces/metadata-provider.interface.js";
import type { IIndexer } from "@/infrastructure/adapters/interfaces/indexer.interface.js";
import type { ITorrentClient } from "@/infrastructure/adapters/interfaces/torrent-client.interface.js";

// Failure tracking for circuit breaker
interface FailureRecord {
  providerId: string;
  failureCount: number;
  lastFailureAt: number;
  cooldownUntil: number;
}

/**
 * Abstract base class for provider registries
 * Handles common functionality like registration, failure tracking, and availability checks
 */
export abstract class ProviderRegistry<T> {
  protected providers: Map<string, T> = new Map();
  protected failures: Map<string, FailureRecord> = new Map();
  protected logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Register a provider instance
   */
  register(id: string, provider: T): void {
    this.providers.set(id, provider);
    this.logger.debug({ providerId: id }, "Provider registered");
  }

  /**
   * Unregister a provider instance
   */
  unregister(id: string): void {
    this.providers.delete(id);
    this.failures.delete(id);
    this.logger.debug({ providerId: id }, "Provider unregistered");
  }

  /**
   * Get a specific provider by ID
   */
  get(id: string): T | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all registered providers with their IDs
   */
  getAll(): Array<{ id: string; provider: T }> {
    return Array.from(this.providers.entries()).map(([id, provider]) => ({ id, provider }));
  }

  /**
   * Record a failure for a provider
   * Implements circuit breaker: 3 failures = 1 hour cooldown
   */
  recordFailure(providerId: string): void {
    const record = this.failures.get(providerId) || {
      providerId,
      failureCount: 0,
      lastFailureAt: 0,
      cooldownUntil: 0,
    };

    record.failureCount++;
    record.lastFailureAt = Date.now();

    // Circuit breaker: 3 failures = 1 hour cooldown
    if (record.failureCount >= 3) {
      record.cooldownUntil = Date.now() + 60 * 60 * 1000; // 1 hour
      this.logger.warn(
        { providerId, failureCount: record.failureCount },
        "Provider in cooldown due to repeated failures"
      );
    }

    this.failures.set(providerId, record);
  }

  /**
   * Record a success for a provider
   * Resets failure count
   */
  recordSuccess(providerId: string): void {
    const record = this.failures.get(providerId);
    if (record) {
      record.failureCount = 0;
      record.cooldownUntil = 0;
      this.failures.set(providerId, record);
    }
  }

  /**
   * Check if a provider is available (not in cooldown)
   */
  isAvailable(providerId: string): boolean {
    const record = this.failures.get(providerId);
    if (!record) return true;
    if (Date.now() < record.cooldownUntil) return false;
    return true;
  }

  /**
   * Get all available (not in cooldown) providers
   * Must be implemented by subclasses
   */
  abstract getAvailable(): Array<{ id: string; provider: T }>;
}

/**
 * Registry for metadata providers (TPDB, StashDB, etc.)
 */
export class MetadataProviderRegistry extends ProviderRegistry<IMetadataProvider> {
  getAvailable(): Array<{ id: string; provider: IMetadataProvider }> {
    return this.getAll().filter(({ id }) => this.isAvailable(id));
  }

  /**
   * Get metadata providers sorted by priority
   */
  getSortedByPriority(): Array<{ id: string; provider: IMetadataProvider; priority: number }> {
    // This will be populated with priority from settings
    return this.getAvailable();
  }

  /**
   * Get the primary (highest priority) metadata provider
   */
  getPrimary(): { id: string; provider: IMetadataProvider } | undefined {
    const available = this.getAvailable();
    return available.length > 0 ? available[0] : undefined;
  }
}

/**
 * Registry for indexer services (Prowlarr, Jackett, etc.)
 */
export class IndexerRegistry extends ProviderRegistry<IIndexer> {
  getAvailable(): Array<{ id: string; provider: IIndexer }> {
    return this.getAll().filter(({ id }) => this.isAvailable(id));
  }

  /**
   * Get indexers sorted by priority
   */
  getSortedByPriority(): Array<{ id: string; provider: IIndexer; priority: number }> {
    return this.getAvailable();
  }
}

/**
 * Registry for torrent clients (qBittorrent, Transmission, etc.)
 */
export class TorrentClientRegistry extends ProviderRegistry<ITorrentClient> {
  getAvailable(): Array<{ id: string; provider: ITorrentClient }> {
    return this.getAll().filter(({ id }) => this.isAvailable(id));
  }

  /**
   * Get torrent clients sorted by priority
   */
  getSortedByPriority(): Array<{ id: string; provider: ITorrentClient; priority: number }> {
    return this.getAvailable();
  }

  /**
   * Get the primary (highest priority) torrent client
   */
  getPrimary(): { id: string; provider: ITorrentClient } | undefined {
    const available = this.getAvailable();
    return available.length > 0 ? available[0] : undefined;
  }
}

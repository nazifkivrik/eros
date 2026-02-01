import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DownloadQueueRepository } from './download-queue.repository.js';
import { createTestDatabase, cleanDatabase } from '../../../test/fixtures/database.fixture.js';
import { mockSceneData } from '../../../test/fixtures/scenes.fixture.js';
import { nanoid } from 'nanoid';
import * as schema from '@repo/database/schema';
import type { DownloadStatus } from '@repo/shared-types';

describe('DownloadQueueRepository', () => {
  let repository: DownloadQueueRepository;
  let db: Awaited<ReturnType<typeof createTestDatabase>>;

  // Helper function to create valid download queue data
  function createMockDownloadQueueData(overrides: Partial<typeof schema.downloadQueue.$inferInsert> = {}) {
    return {
      id: nanoid(),
      sceneId: 'scene-1',
      title: 'Test Scene - 1080p',
      size: 1073741824,
      seeders: 10,
      quality: '1080p',
      status: 'queued' as DownloadStatus,
      torrentHash: 'abc123',
      addedAt: '2024-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  beforeEach(async () => {
    db = await createTestDatabase();
    repository = new DownloadQueueRepository({ db });
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  describe('create', () => {
    it('should create a download queue item', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'scene-1' };
      await db.insert(schema.scenes).values(scene);

      const data = createMockDownloadQueueData();

      // Act
      const result = await repository.create(data);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(data.id);
      expect(result?.status).toBe('queued');
      expect(result?.scene).toBeDefined();
      expect(result?.scene?.id).toBe('scene-1');
    });
  });

  describe('findById', () => {
    it('should return item when found', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'scene-1' };
      await db.insert(schema.scenes).values(scene);

      const data = createMockDownloadQueueData();
      await repository.create(data);

      // Act
      const result = await repository.findById(data.id);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(data.id);
    });

    it('should return null when not found', async () => {
      // Act
      const result = await repository.findById('non-existent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findBySceneIdAndStatus', () => {
    it('should find item by scene ID and status', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'scene-1' };
      await db.insert(schema.scenes).values(scene);

      const item1 = createMockDownloadQueueData({ id: nanoid(), status: 'queued' as DownloadStatus, torrentHash: 'abc123' });
      const item2 = createMockDownloadQueueData({ id: nanoid(), status: 'downloading' as DownloadStatus, torrentHash: 'def456' });
      await repository.create(item1);
      await repository.create(item2);

      // Act
      const result = await repository.findBySceneIdAndStatus('scene-1', 'queued');

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(item1.id);
      expect(result?.status).toBe('queued');
    });

    it('should return null when not found', async () => {
      // Act
      const result = await repository.findBySceneIdAndStatus('non-existent', 'queued');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      // Create test data
      const scene = { ...mockSceneData.scene, id: 'scene-1' };
      await db.insert(schema.scenes).values(scene);

      const item1 = createMockDownloadQueueData({ id: nanoid(), status: 'queued' as DownloadStatus, addedAt: '2024-01-01T00:00:00.000Z' });
      const item2 = createMockDownloadQueueData({ id: nanoid(), status: 'downloading' as DownloadStatus, addedAt: '2024-01-02T00:00:00.000Z' });
      const item3 = createMockDownloadQueueData({ id: nanoid(), status: 'completed' as DownloadStatus, addedAt: '2024-01-03T00:00:00.000Z' });
      await repository.create(item1);
      await repository.create(item2);
      await repository.create(item3);
    });

    it('should return all items ordered by addedAt desc', async () => {
      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].status).toBe('completed'); // Most recent
      expect(result[1].status).toBe('downloading');
      expect(result[2].status).toBe('queued'); // Oldest
    });

    it('should filter by status when provided', async () => {
      // Act
      const result = await repository.findAll('queued');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('queued');
    });

    it('should return empty array when no items', async () => {
      // Arrange
      await cleanDatabase(db);

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update item fields', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'scene-1' };
      await db.insert(schema.scenes).values(scene);

      const data = createMockDownloadQueueData();
      await repository.create(data);

      // Act
      const result = await repository.update(data.id, {
        status: 'downloading',
        qbitHash: 'xyz789',
      });

      // Assert
      expect(result).toBeDefined();
      expect(result?.status).toBe('downloading');
      expect(result?.qbitHash).toBe('xyz789');
    });

    it('should return null when item not found', async () => {
      // Act
      const result = await repository.update('non-existent', { status: 'downloading' });

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete item', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'scene-1' };
      await db.insert(schema.scenes).values(scene);

      const data = createMockDownloadQueueData();
      await repository.create(data);

      // Act
      await repository.delete(data.id);

      // Assert
      const result = await repository.findById(data.id);
      expect(result).toBeNull();
    });
  });

  describe('findAllWithFullDetails', () => {
    it('should return items with scene and studio info', async () => {
      // Arrange
      const studio = {
        id: 'studio-1',
        externalIds: [],
        name: 'Test Studio',
        slug: 'test-studio',
      };
      await db.insert(schema.studios).values(studio);

      const scene = {
        ...mockSceneData.scene,
        id: 'scene-1',
        siteId: 'studio-1',
      };
      await db.insert(schema.scenes).values(scene);

      const data = createMockDownloadQueueData();
      await repository.create(data);

      // Act
      const result = await repository.findAllWithFullDetails();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].scene).toBeDefined();
      expect(result[0].scene?.site).toBeDefined();
      expect(result[0].scene?.site?.name).toBe('Test Studio');
    });
  });

  describe('sceneExists', () => {
    it('should return true when scene exists', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'scene-1' };
      await db.insert(schema.scenes).values(scene);

      // Act
      const result = await repository.sceneExists('scene-1');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when scene does not exist', async () => {
      // Act
      const result = await repository.sceneExists('non-existent');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('findAddFailedItems', () => {
    beforeEach(async () => {
      // Create test data
      const scene = { ...mockSceneData.scene, id: 'scene-1' };
      await db.insert(schema.scenes).values(scene);

      const now = new Date().toISOString();

      // Item that failed recently (within retry window)
      const recentFailed = createMockDownloadQueueData({
        id: nanoid(),
        status: 'add_failed' as DownloadStatus,
        torrentHash: 'recent123',
        addedAt: now,
        addToClientAttempts: 1,
        addToClientLastAttempt: now,
      });

      // Item that failed a long time ago (outside retry window)
      const oldFailed = createMockDownloadQueueData({
        id: nanoid(),
        status: 'add_failed' as DownloadStatus,
        torrentHash: 'old123',
        addedAt: '2024-01-01T00:00:00.000Z',
        addToClientAttempts: 1,
        addToClientLastAttempt: '2024-01-01T00:00:00.000Z',
      });

      // Item that exceeded max attempts
      const maxAttemptsReached = createMockDownloadQueueData({
        id: nanoid(),
        status: 'add_failed' as DownloadStatus,
        torrentHash: 'max123',
        addedAt: '2024-01-01T00:00:00.000Z',
        addToClientAttempts: 10,
        addToClientLastAttempt: '2024-01-01T00:00:00.000Z',
      });

      // Item with no last attempt time
      const noLastAttempt = createMockDownloadQueueData({
        id: nanoid(),
        status: 'add_failed' as DownloadStatus,
        torrentHash: 'noattempt123',
        addedAt: '2024-01-01T00:00:00.000Z',
        addToClientAttempts: 1,
        addToClientLastAttempt: null,
      });

      await repository.create(recentFailed);
      await repository.create(oldFailed);
      await repository.create(maxAttemptsReached);
      await repository.create(noLastAttempt);
    });

    it('should find items that need retry', async () => {
      // Act - maxAttempts: 5, retryAfterMinutes: 60
      const result = await repository.findAddFailedItems(5, 60);

      // Assert - should find oldFailed and noLastAttempt, but not recentFailed or maxAttemptsReached
      expect(result.length).toBeGreaterThanOrEqual(1);
      const ids = result.map((r) => r.torrentHash);
      expect(ids).toContain('old123');
      expect(ids).toContain('noattempt123');
      expect(ids).not.toContain('recent123');
      expect(ids).not.toContain('max123');
    });
  });

  describe('updateRetryTracking', () => {
    it('should update retry tracking fields', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'scene-1' };
      await db.insert(schema.scenes).values(scene);

      const data = createMockDownloadQueueData({
        status: 'add_failed' as DownloadStatus,
        addToClientAttempts: 1,
        addToClientLastAttempt: '2024-01-01T00:00:00.000Z',
      });
      await repository.create(data);

      const now = new Date().toISOString();

      // Act
      const result = await repository.updateRetryTracking(data.id, {
        addToClientAttempts: 2,
        addToClientLastAttempt: now,
        addToClientError: 'Connection timeout',
        status: 'downloading',
        qbitHash: 'xyz789',
      });

      // Assert
      expect(result).toBeDefined();
      expect(result?.addToClientAttempts).toBe(2);
      expect(result?.addToClientLastAttempt).toBe(now);
      expect(result?.addToClientError).toBe('Connection timeout');
      expect(result?.status).toBe('downloading');
      expect(result?.qbitHash).toBe('xyz789');
    });
  });

  describe('findByTorrentHash', () => {
    it('should find item by torrent hash', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'scene-1' };
      await db.insert(schema.scenes).values(scene);

      const data = createMockDownloadQueueData({
        torrentHash: 'abc123def456',
      });
      await repository.create(data);

      // Act
      const result = await repository.findByTorrentHash('abc123def456');

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(data.id);
      expect(result?.torrentHash).toBe('abc123def456');
    });

    it('should return null when hash not found', async () => {
      // Act
      const result = await repository.findByTorrentHash('nonexistent');

      // Assert
      expect(result).toBeNull();
    });
  });
});

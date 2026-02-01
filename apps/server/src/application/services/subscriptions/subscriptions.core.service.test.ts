import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionsCoreService } from './subscriptions.core.service.js';
import { createMockLogger } from '../../../../test/mocks/logger.mock.js';
import { SubscriptionsRepository } from '@/infrastructure/repositories/subscriptions.repository.js';
import { createTestDatabase, cleanDatabase } from '../../../../test/fixtures/database.fixture.js';
import { mockSubscriptionData, mockQualityProfileData } from '../../../../test/fixtures/subscriptions.fixture.js';
import { mockPerformerData } from '../../../../test/fixtures/performers.fixture.js';
import { mockSceneData } from '../../../../test/fixtures/scenes.fixture.js';
import { nanoid } from 'nanoid';
import * as schema from '@repo/database/schema';

describe('SubscriptionsCoreService', () => {
  let service: SubscriptionsCoreService;
  let repository: SubscriptionsRepository;
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  let logger: any;

  beforeEach(async () => {
    db = await createTestDatabase();
    repository = new SubscriptionsRepository({ db });
    logger = createMockLogger();
    service = new SubscriptionsCoreService({ subscriptionsRepository: repository, logger });

    // Create default quality profile
    await db.insert(schema.qualityProfiles).values({
      id: 'quality-1',
      name: `1080p-${nanoid()}`,
      items: [
        {
          quality: '1080p',
          source: 'any',
          minSeeders: 'any' as const,
          maxSize: 8589934592,
        },
      ],
    });
  });

  describe('getAll', () => {
    it('should return all subscriptions', async () => {
      // Arrange
      await db.insert(schema.subscriptions).values({
        ...mockSubscriptionData.performerSubscription,
        id: 'sub-1',
      });

      // Act
      const result = await service.getAll();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sub-1');
    });

    it('should return empty array when no subscriptions', async () => {
      // Act
      const result = await service.getAll();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getByType', () => {
    beforeEach(async () => {
      await db.insert(schema.subscriptions).values([
        mockSubscriptionData.performerSubscription,
        mockSubscriptionData.studioSubscription,
      ]);
    });

    it('should return performer subscriptions', async () => {
      // Act
      const result = await service.getByType('performer');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].entityType).toBe('performer');
    });

    it('should return studio subscriptions', async () => {
      // Act
      const result = await service.getByType('studio');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].entityType).toBe('studio');
    });

    it('should return empty array for type with no subscriptions', async () => {
      // Act
      const result = await service.getByType('scene');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getById', () => {
    it('should return subscription when found', async () => {
      // Arrange
      await db.insert(schema.subscriptions).values(mockSubscriptionData.performerSubscription);

      // Act
      const result = await service.getById('sub-performer-1');

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe('sub-performer-1');
    });

    it('should throw error when not found', async () => {
      // Act & Assert
      await expect(service.getById('non-existent')).rejects.toThrow('Subscription not found');
    });
  });

  describe('getByIdWithDetails', () => {
    beforeEach(async () => {
      await db.insert(schema.performers).values(mockPerformerData.performer);
      await db.insert(schema.subscriptions).values(mockSubscriptionData.performerSubscription);
    });

    it('should return subscription with entity details', async () => {
      // Act
      const result = await service.getByIdWithDetails('sub-performer-1');

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe('sub-performer-1');
      expect(result?.entity).toBeDefined();
      expect(result?.entityName).toBe('Jane Doe');
    });

    it('should use entityId when entity not found', async () => {
      // Arrange
      const sub = {
        ...mockSubscriptionData.performerSubscription,
        id: 'sub-orphan',
        entityId: 'non-existent-performer',
      };
      await db.insert(schema.subscriptions).values(sub);

      // Act
      const result = await service.getByIdWithDetails('sub-orphan');

      // Assert
      expect(result).toBeDefined();
      expect(result?.entityName).toBe('non-existent-performer');
    });

    it('should throw error when subscription not found', async () => {
      // Act & Assert
      await expect(service.getByIdWithDetails('non-existent')).rejects.toThrow('Subscription not found');
    });
  });

  describe('checkSubscriptionByEntity', () => {
    beforeEach(async () => {
      await db.insert(schema.subscriptions).values(mockSubscriptionData.performerSubscription);
    });

    it('should return subscribed=true for existing subscription', async () => {
      // Act
      const result = await service.checkSubscriptionByEntity('performer', 'performer-1');

      // Assert
      expect(result.subscribed).toBe(true);
      expect(result.subscription).toBeDefined();
      expect(result.subscription?.id).toBe('sub-performer-1');
    });

    it('should return subscribed=false for non-existent subscription', async () => {
      // Act
      const result = await service.checkSubscriptionByEntity('performer', 'non-existent');

      // Assert
      expect(result.subscribed).toBe(false);
      expect(result.subscription).toBeNull();
    });
  });

  describe('createBasic', () => {
    it('should create a new subscription', async () => {
      // Arrange
      const dto = {
        entityType: 'performer' as const,
        entityId: 'new-performer',
        qualityProfileId: 'quality-1',
        autoDownload: true,
        includeMetadataMissing: false,
        includeAliases: false,
      };

      // Act
      const result = await service.createBasic(dto);

      // Assert
      expect(result).toBeDefined();
      expect(result.entityType).toBe('performer');
      expect(result.entityId).toBe('new-performer');
      expect(result.isSubscribed).toBe(true);
    });

    it('should throw error when subscription already exists', async () => {
      // Arrange
      await db.insert(schema.subscriptions).values(mockSubscriptionData.performerSubscription);

      const dto = {
        entityType: 'performer' as const,
        entityId: 'performer-1',
        qualityProfileId: 'quality-1',
        autoDownload: true,
        includeMetadataMissing: false,
        includeAliases: false,
      };

      // Act & Assert
      await expect(service.createBasic(dto)).rejects.toThrow('Subscription already exists for this entity');
    });
  });

  describe('update', () => {
    it('should update subscription fields', async () => {
      // Arrange
      await db.insert(schema.subscriptions).values(mockSubscriptionData.performerSubscription);

      const dto = {
        autoDownload: false,
        includeAliases: true,
      };

      // Act
      const result = await service.update('sub-performer-1', dto);

      // Assert
      expect(result).toBeDefined();
      expect(result?.autoDownload).toBe(false);
      expect(result?.includeAliases).toBe(true);
      expect(result?.updatedAt).toBeDefined();
    });

    it('should update quality profile', async () => {
      // Arrange
      await db.insert(schema.subscriptions).values(mockSubscriptionData.performerSubscription);

      const dto = {
        qualityProfileId: 'quality-1',
      };

      // Act
      const result = await service.update('sub-performer-1', dto);

      // Assert
      expect(result?.qualityProfileId).toBe('quality-1');
    });

    it('should throw error when subscription not found', async () => {
      // Act & Assert
      await expect(service.update('non-existent', { autoDownload: false })).rejects.toThrow('Subscription not found');
    });
  });

  describe('deleteBasic', () => {
    it('should delete subscription', async () => {
      // Arrange
      await db.insert(schema.subscriptions).values(mockSubscriptionData.performerSubscription);

      // Act
      const result = await service.deleteBasic('sub-performer-1');

      // Assert
      expect(result.success).toBe(true);
      const deleted = await repository.findById('sub-performer-1');
      expect(deleted).toBeNull();
    });

    it('should throw error when subscription not found', async () => {
      // Act & Assert
      await expect(service.deleteBasic('non-existent')).rejects.toThrow('Subscription not found');
    });
  });

  describe('toggleStatus', () => {
    it('should toggle from active to inactive', async () => {
      // Arrange
      await db.insert(schema.subscriptions).values(mockSubscriptionData.performerSubscription);

      // Act
      const result = await service.toggleStatus('sub-performer-1');

      // Assert
      expect(result?.isSubscribed).toBe(false);
    });

    it('should toggle from inactive to active', async () => {
      // Arrange
      const sub = { ...mockSubscriptionData.performerSubscription, isSubscribed: false };
      await db.insert(schema.subscriptions).values(sub);

      // Act
      const result = await service.toggleStatus('sub-performer-1');

      // Assert
      expect(result?.isSubscribed).toBe(true);
    });
  });

  describe('getSubscriptionScenes', () => {
    beforeEach(async () => {
      // Create performer, scene, and subscription
      await db.insert(schema.performers).values(mockPerformerData.performer);
      await db.insert(schema.scenes).values(mockSceneData.scene);
      await db.insert(schema.subscriptions).values(mockSubscriptionData.performerSubscription);
    });

    it('should return scenes for performer subscription', async () => {
      // Act
      const result = await service.getSubscriptionScenes('sub-performer-1');

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw error for scene subscriptions', async () => {
      // Arrange
      await db.insert(schema.subscriptions).values(mockSubscriptionData.sceneSubscription);

      // Act & Assert
      await expect(service.getSubscriptionScenes('sub-scene-1')).rejects.toThrow(
        'This endpoint is only for performer/studio subscriptions'
      );
    });

    it('should enrich scenes with download status', async () => {
      // Act
      const result = await service.getSubscriptionScenes('sub-performer-1');

      // Assert
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('downloadStatus');
        expect(result[0]).toHaveProperty('hasFiles');
      }
    });
  });

  describe('getSubscriptionFiles', () => {
    beforeEach(async () => {
      await db.insert(schema.scenes).values(mockSceneData.scene);
      await db.insert(schema.subscriptions).values(mockSubscriptionData.sceneSubscription);
    });

    it('should return files for scene subscription', async () => {
      // Act
      const result = await service.getSubscriptionFiles('sub-scene-1');

      // Assert
      expect(result).toBeDefined();
      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('downloadQueue');
    });

    it('should throw error for performer subscriptions', async () => {
      // Arrange - Create performer subscription
      await db.insert(schema.subscriptions).values(mockSubscriptionData.performerSubscription);

      // Act & Assert
      await expect(service.getSubscriptionFiles('sub-performer-1')).rejects.toThrow(
        'This endpoint is only for scene subscriptions'
      );
    });
  });
});

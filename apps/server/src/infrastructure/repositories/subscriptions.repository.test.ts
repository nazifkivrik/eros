import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SubscriptionsRepository } from './subscriptions.repository.js';
import { createTestDatabase, cleanDatabase } from '../../../test/fixtures/database.fixture.js';
import { mockSubscriptionData, mockQualityProfileData } from '../../../test/fixtures/subscriptions.fixture.js';
import { mockPerformerData } from '../../../test/fixtures/performers.fixture.js';
import { mockSceneData, mockStudioData } from '../../../test/fixtures/scenes.fixture.js';
import { nanoid } from 'nanoid';
import * as schema from '@repo/database/schema';

describe('SubscriptionsRepository', () => {
  let repository: SubscriptionsRepository;
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  let defaultQualityProfileId: string;

  beforeEach(async () => {
    db = await createTestDatabase();
    repository = new SubscriptionsRepository({ db });

    // Create default quality profile for all tests
    // Use fixed ID 'quality-1' to match mock subscription data
    defaultQualityProfileId = 'quality-1';
    await db.insert(schema.qualityProfiles).values({
      id: defaultQualityProfileId,
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

  afterEach(async () => {
    await cleanDatabase(db);
  });

  describe('create', () => {
    it('should create a performer subscription', async () => {
      // Arrange
      const data = {
        id: nanoid(),
        entityType: 'performer' as const,
        entityId: 'performer-1',
        qualityProfileId: defaultQualityProfileId,
        autoDownload: true,
        includeMetadataMissing: false,
        includeAliases: false,
        isSubscribed: true,
        searchCutoffDate: null,
      };

      // Act
      const result = await repository.create(data);

      // Assert
      expect(result).toEqual(data);
    });

    it('should create a studio subscription', async () => {
      // Arrange
      const data = {
        id: nanoid(),
        entityType: 'studio' as const,
        entityId: 'studio-1',
        qualityProfileId: defaultQualityProfileId,
        autoDownload: false,
        includeMetadataMissing: true,
        includeAliases: false,
        isSubscribed: true,
        searchCutoffDate: '2024-01-01T00:00:00.000Z',
      };

      // Act
      const result = await repository.create(data);

      // Assert
      expect(result).toEqual(data);
    });

    it('should create a scene subscription', async () => {
      // Arrange
      const data = {
        id: nanoid(),
        entityType: 'scene' as const,
        entityId: 'scene-1',
        qualityProfileId: defaultQualityProfileId,
        autoDownload: true,
        includeMetadataMissing: false,
        includeAliases: false,
        isSubscribed: true,
        searchCutoffDate: null,
      };

      // Act
      const result = await repository.create(data);

      // Assert
      expect(result).toEqual(data);
    });
  });

  describe('findById', () => {
    it('should return subscription when found', async () => {
      // Arrange
      const data = { ...mockSubscriptionData.performerSubscription, id: nanoid() };
      await repository.create(data);

      // Act
      const result = await repository.findById(data.id);

      // Assert
      expect(result).toEqual(data);
    });

    it('should return null when not found', async () => {
      // Act
      const result = await repository.findById('non-existent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findByEntity', () => {
    it('should find subscription by performer entity', async () => {
      // Arrange
      const data = { ...mockSubscriptionData.performerSubscription, id: nanoid() };
      await repository.create(data);

      // Act
      const result = await repository.findByEntity('performer', data.entityId);

      // Assert
      expect(result).toEqual(data);
    });

    it('should find subscription by studio entity', async () => {
      // Arrange
      const data = { ...mockSubscriptionData.studioSubscription, id: nanoid() };
      await repository.create(data);

      // Act
      const result = await repository.findByEntity('studio', data.entityId);

      // Assert
      expect(result).toEqual(data);
    });

    it('should find subscription by scene entity', async () => {
      // Arrange
      const data = { ...mockSubscriptionData.sceneSubscription, id: nanoid() };
      await repository.create(data);

      // Act
      const result = await repository.findByEntity('scene', data.entityId);

      // Assert
      expect(result).toEqual(data);
    });

    it('should return null when not found', async () => {
      // Act
      const result = await repository.findByEntity('performer', 'non-existent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all subscriptions ordered by createdAt desc', async () => {
      // Arrange
      const sub1 = { ...mockSubscriptionData.performerSubscription, id: nanoid(), createdAt: '2024-01-01T00:00:00.000Z' };
      const sub2 = { ...mockSubscriptionData.studioSubscription, id: nanoid(), createdAt: '2024-01-02T00:00:00.000Z' }; // Newer
      await repository.create(sub1);
      await repository.create(sub2);

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(sub2.id); // Most recent first
      expect(result[1].id).toBe(sub1.id);
    });

    it('should return empty array when none exist', async () => {
      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('findByType', () => {
    it('should find all performer subscriptions', async () => {
      // Arrange
      const performerSub = { ...mockSubscriptionData.performerSubscription, id: nanoid(), entityId: 'p1' };
      const studioSub = { ...mockSubscriptionData.studioSubscription, id: nanoid() };
      await repository.create(performerSub);
      await repository.create(studioSub);

      // Act
      const result = await repository.findByType('performer');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].entityType).toBe('performer');
    });

    it('should find all studio subscriptions', async () => {
      // Arrange
      const performerSub = { ...mockSubscriptionData.performerSubscription, id: nanoid() };
      const studioSub = { ...mockSubscriptionData.studioSubscription, id: nanoid(), entityId: 's1' };
      await repository.create(performerSub);
      await repository.create(studioSub);

      // Act
      const result = await repository.findByType('studio');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].entityType).toBe('studio');
    });

    it('should find all scene subscriptions', async () => {
      // Arrange
      const sceneSub = { ...mockSubscriptionData.sceneSubscription, id: nanoid(), entityId: 'sc1' };
      const performerSub = { ...mockSubscriptionData.performerSubscription, id: nanoid() };
      await repository.create(sceneSub);
      await repository.create(performerSub);

      // Act
      const result = await repository.findByType('scene');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].entityType).toBe('scene');
    });
  });

  describe('update', () => {
    it('should update subscription fields', async () => {
      // Arrange
      const data = { ...mockSubscriptionData.performerSubscription, id: nanoid() };
      await repository.create(data);

      // Act
      const result = await repository.update(data.id, {
        autoDownload: false,
        includeAliases: true,
      });

      // Assert
      expect(result?.autoDownload).toBe(false);
      expect(result?.includeAliases).toBe(true);
      expect(result?.entityType).toBe('performer'); // Unchanged
    });

    it('should return null when subscription not found', async () => {
      // Act
      const result = await repository.update('non-existent', { autoDownload: false });

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete subscription', async () => {
      // Arrange
      const data = { ...mockSubscriptionData.performerSubscription, id: nanoid() };
      await repository.create(data);

      // Act
      await repository.delete(data.id);

      // Assert
      const result = await repository.findById(data.id);
      expect(result).toBeNull();
    });

    it('should not throw when deleting non-existent', async () => {
      // Act & Assert - should not throw
      await expect(repository.delete('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('exists', () => {
    it('should return true when subscription exists', async () => {
      // Arrange
      const data = { ...mockSubscriptionData.performerSubscription, id: nanoid() };
      await repository.create(data);

      // Act
      const result = await repository.exists(data.id);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when subscription does not exist', async () => {
      // Act
      const result = await repository.exists('non-existent');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('batchFetchPerformers', () => {
    it('should return empty map when ids array is empty', async () => {
      // Act
      const result = await repository.batchFetchPerformers([]);

      // Assert
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should batch fetch performers by ids', async () => {
      // Arrange
      const performer1 = { ...mockPerformerData.performer, id: 'p1', name: 'Performer 1' };
      const performer2 = { ...mockPerformerData.performer, id: 'p2', name: 'Performer 2' };
      await db.insert(schema.performers).values([performer1, performer2]);

      // Act
      const result = await repository.batchFetchPerformers(['p1', 'p2']);

      // Assert
      expect(result.size).toBe(2);
      expect(result.get('p1')?.name).toBe('Performer 1');
      expect(result.get('p2')?.name).toBe('Performer 2');
    });
  });

  describe('batchFetchStudios', () => {
    it('should return empty map when ids array is empty', async () => {
      // Act
      const result = await repository.batchFetchStudios([]);

      // Assert
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should batch fetch studios by ids', async () => {
      // Arrange
      const studio1 = { ...mockStudioData.studio, id: 's1', name: 'Studio 1' };
      const studio2 = { ...mockStudioData.studio, id: 's2', name: 'Studio 2' };
      await db.insert(schema.studios).values([studio1, studio2]);

      // Act
      const result = await repository.batchFetchStudios(['s1', 's2']);

      // Assert
      expect(result.size).toBe(2);
      expect(result.get('s1')?.name).toBe('Studio 1');
      expect(result.get('s2')?.name).toBe('Studio 2');
    });
  });

  describe('batchFetchScenes', () => {
    it('should return empty map when ids array is empty', async () => {
      // Act
      const result = await repository.batchFetchScenes([]);

      // Assert
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should batch fetch scenes by ids', async () => {
      // Arrange
      const scene1 = { ...mockSceneData.scene, id: 'sc1', title: 'Scene 1' };
      const scene2 = { ...mockSceneData.scene, id: 'sc2', title: 'Scene 2' };
      await db.insert(schema.scenes).values([scene1, scene2]);

      // Act
      const result = await repository.batchFetchScenes(['sc1', 'sc2']);

      // Assert
      expect(result.size).toBe(2);
      expect(result.get('sc1')?.title).toBe('Scene 1');
      expect(result.get('sc2')?.title).toBe('Scene 2');
    });
  });

  describe('batchFetchQualityProfiles', () => {
    it('should return empty map when ids array is empty', async () => {
      // Act
      const result = await repository.batchFetchQualityProfiles([]);

      // Assert
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should batch fetch quality profiles by ids', async () => {
      // Arrange
      const qp1 = { ...mockQualityProfileData.qualityProfile, id: 'qp1', name: `1080p-${nanoid()}` };
      const qp2 = { ...mockQualityProfileData.qualityProfile, id: 'qp2', name: `4K-${nanoid()}` };
      await db.insert(schema.qualityProfiles).values([qp1, qp2]);

      // Act
      const result = await repository.batchFetchQualityProfiles(['qp1', 'qp2']);

      // Assert
      expect(result.size).toBe(2);
      expect(result.get('qp1')?.name).toContain('1080p');
      expect(result.get('qp2')?.name).toContain('4K');
    });
  });

  describe('findByIdWithDetails', () => {
    it('should include performer entity', async () => {
      // Arrange
      const performer = { ...mockPerformerData.performer, id: 'p1', name: 'Jane Doe' };
      const qualityProfile = { ...mockQualityProfileData.qualityProfile, id: 'qp1' };
      const subscription = {
        ...mockSubscriptionData.performerSubscription,
        id: nanoid(),
        entityId: 'p1',
        qualityProfileId: 'qp1',
      };

      await db.insert(schema.performers).values(performer);
      await db.insert(schema.qualityProfiles).values(qualityProfile);
      await repository.create(subscription);

      // Act
      const result = await repository.findByIdWithDetails(subscription.id);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.entity).toBeDefined();
      expect(result?.entity?.name).toBe('Jane Doe');
      expect(result?.entityName).toBe('Jane Doe');
      expect(result?.qualityProfile?.name).toBe('1080p');
    });

    it('should include studio entity', async () => {
      // Arrange
      const studio = { ...mockStudioData.studio, id: 's1', name: 'Test Studio' };
      const qualityProfile = { ...mockQualityProfileData.qualityProfile, id: 'qp1' };
      const subscription = {
        ...mockSubscriptionData.studioSubscription,
        id: nanoid(),
        entityId: 's1',
        qualityProfileId: 'qp1',
      };

      await db.insert(schema.studios).values(studio);
      await db.insert(schema.qualityProfiles).values(qualityProfile);
      await repository.create(subscription);

      // Act
      const result = await repository.findByIdWithDetails(subscription.id);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.entity).toBeDefined();
      expect(result?.entity?.name).toBe('Test Studio');
      expect(result?.entityName).toBe('Test Studio');
    });

    it('should include scene entity', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'sc1', title: 'Test Scene' };
      const qualityProfile = { ...mockQualityProfileData.qualityProfile, id: 'qp1' };
      const subscription = {
        ...mockSubscriptionData.sceneSubscription,
        id: nanoid(),
        entityId: 'sc1',
        qualityProfileId: 'qp1',
      };

      await db.insert(schema.scenes).values(scene);
      await db.insert(schema.qualityProfiles).values(qualityProfile);
      await repository.create(subscription);

      // Act
      const result = await repository.findByIdWithDetails(subscription.id);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.entity).toBeDefined();
      expect(result?.entity?.title).toBe('Test Scene');
      expect(result?.entityName).toBe('Test Scene');
    });

    it('should use entityId as entityName when entity not found', async () => {
      // Arrange
      const qualityProfile = { ...mockQualityProfileData.qualityProfile, id: 'qp1' };
      const subscription = {
        ...mockSubscriptionData.performerSubscription,
        id: nanoid(),
        entityId: 'non-existent-performer',
        qualityProfileId: 'qp1',
      };

      await db.insert(schema.qualityProfiles).values(qualityProfile);
      await repository.create(subscription);

      // Act
      const result = await repository.findByIdWithDetails(subscription.id);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.entity).toBeNull();
      expect(result?.entityName).toBe('non-existent-performer');
    });

    it('should return null when subscription not found', async () => {
      // Act
      const result = await repository.findByIdWithDetails('non-existent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findAllWithDetails', () => {
    it('should include performer entity data', async () => {
      // Arrange
      const performer = { ...mockPerformerData.performer, id: 'p1', name: 'Jane Doe' };
      const qualityProfile = { ...mockQualityProfileData.qualityProfile, id: 'qp1' };
      const subscription = {
        ...mockSubscriptionData.performerSubscription,
        id: nanoid(),
        entityId: 'p1',
        qualityProfileId: 'qp1',
      };

      await db.insert(schema.performers).values(performer);
      await db.insert(schema.qualityProfiles).values(qualityProfile);
      await repository.create(subscription);

      // Act
      const result = await repository.findAllWithDetails();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].entity).toBeDefined();
      expect(result[0].entity?.name).toBe('Jane Doe');
      expect(result[0].entityName).toBe('Jane Doe');
      expect(result[0].qualityProfile?.name).toBe('1080p');
    });

    it('should filter by search term (entity name)', async () => {
      // Arrange
      const performer1 = { ...mockPerformerData.performer, id: 'p1', name: 'Jane Doe' };
      const performer2 = { ...mockPerformerData.performer, id: 'p2', name: 'John Smith' };
      const qualityProfile = { ...mockQualityProfileData.qualityProfile, id: 'qp1' };
      const sub1 = {
        ...mockSubscriptionData.performerSubscription,
        id: nanoid(),
        entityId: 'p1',
        qualityProfileId: 'qp1',
      };
      const sub2 = {
        ...mockSubscriptionData.performerSubscription,
        id: nanoid(),
        entityId: 'p2',
        qualityProfileId: 'qp1',
      };

      await db.insert(schema.performers).values([performer1, performer2]);
      await db.insert(schema.qualityProfiles).values(qualityProfile);
      await repository.create(sub1);
      await repository.create(sub2);

      // Act
      const result = await repository.findAllWithDetails({ search: 'Jane' });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].entityName).toBe('Jane Doe');
    });

    it('should filter out metadata-less scenes when includeMetaless is false', async () => {
      // Arrange
      const scene1 = { ...mockSceneData.scene, id: 'sc1', title: 'Scene 1', hasMetadata: true };
      const scene2 = { ...mockSceneData.scene, id: 'sc2', title: 'Scene 2', hasMetadata: false };
      const qualityProfile = { ...mockQualityProfileData.qualityProfile, id: 'qp1' };
      const sub1 = {
        ...mockSubscriptionData.sceneSubscription,
        id: nanoid(),
        entityId: 'sc1',
        qualityProfileId: 'qp1',
      };
      const sub2 = {
        ...mockSubscriptionData.sceneSubscription,
        id: nanoid(),
        entityId: 'sc2',
        qualityProfileId: 'qp1',
      };

      await db.insert(schema.scenes).values([scene1, scene2]);
      await db.insert(schema.qualityProfiles).values(qualityProfile);
      await repository.create(sub1);
      await repository.create(sub2);

      // Act
      const result = await repository.findAllWithDetails({ includeMetaless: false });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].entity?.hasMetadata).toBe(true);
    });

    it('should show only active when showInactive is false', async () => {
      // Arrange
      const qualityProfile = { ...mockQualityProfileData.qualityProfile, id: 'qp1' };
      const sub1 = {
        ...mockSubscriptionData.performerSubscription,
        id: nanoid(),
        entityId: 'p1',
        qualityProfileId: 'qp1',
        isSubscribed: true,
      };
      const sub2 = {
        ...mockSubscriptionData.performerSubscription,
        id: nanoid(),
        entityId: 'p2',
        qualityProfileId: 'qp1',
        isSubscribed: false,
      };

      await db.insert(schema.qualityProfiles).values(qualityProfile);
      await repository.create(sub1);
      await repository.create(sub2);

      // Act
      const result = await repository.findAllWithDetails({ showInactive: false });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].isSubscribed).toBe(true);
    });
  });

  describe('getPerformerScenes', () => {
    it('should get scenes from performers_scenes junction', async () => {
      // Arrange
      const performer = { ...mockPerformerData.performer, id: 'p1' };
      const scene = { ...mockSceneData.scene, id: 'sc1', title: 'Test Scene' };
      await db.insert(schema.performers).values(performer);
      await db.insert(schema.scenes).values(scene);
      await db.insert(schema.performersScenes).values({ performerId: 'p1', sceneId: 'sc1' });

      // Act
      const result = await repository.getPerformerScenes('p1');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sc1');
    });

    it('should return empty array for non-existent performer', async () => {
      // Act
      const result = await repository.getPerformerScenes('non-existent');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getStudioScenes', () => {
    it('should get scenes with matching siteId', async () => {
      // Arrange
      const studio = { ...mockStudioData.studio, id: 's1' };
      const scene = { ...mockSceneData.scene, id: 'sc1', title: 'Test Scene', siteId: 's1' };
      await db.insert(schema.studios).values(studio);
      await db.insert(schema.scenes).values(scene);

      // Act
      const result = await repository.getStudioScenes('s1');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sc1');
    });

    it('should return empty array for non-existent studio', async () => {
      // Act
      const result = await repository.getStudioScenes('non-existent');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getSceneDownloadQueue', () => {
    it('should get download queue entry for scene', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'sc1' };
      const queueItem = {
        id: nanoid(),
        sceneId: 'sc1',
        torrentHash: null,
        qbitHash: null,
        title: 'Test Torrent',
        size: 1000000,
        seeders: 10,
        quality: '1080p',
        status: 'queued',
      };
      await db.insert(schema.scenes).values(scene);
      await db.insert(schema.downloadQueue).values(queueItem);

      // Act
      const result = await repository.getSceneDownloadQueue('sc1');

      // Assert
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Test Torrent');
    });

    it('should return most recent entry by addedAt', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'sc1' };
      const item1 = {
        id: nanoid(),
        sceneId: 'sc1',
        torrentHash: null,
        qbitHash: null,
        title: 'Old Torrent',
        size: 1000000,
        seeders: 10,
        quality: '1080p',
        status: 'queued',
        addedAt: '2024-01-01T00:00:00.000Z',
      };
      const item2 = {
        id: nanoid(),
        sceneId: 'sc1',
        torrentHash: null,
        qbitHash: null,
        title: 'New Torrent',
        size: 2000000,
        seeders: 20,
        quality: '1080p',
        status: 'queued',
        addedAt: '2024-01-02T00:00:00.000Z',
      };
      await db.insert(schema.scenes).values(scene);
      await db.insert(schema.downloadQueue).values([item1, item2]);

      // Act
      const result = await repository.getSceneDownloadQueue('sc1');

      // Assert
      expect(result?.title).toBe('New Torrent');
    });

    it('should return null when no entry exists', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'sc1' };
      await db.insert(schema.scenes).values(scene);

      // Act
      const result = await repository.getSceneDownloadQueue('sc1');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getSceneFiles', () => {
    it('should get files for scene', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'sc1' };
      const file = {
        id: nanoid(),
        sceneId: 'sc1',
        filePath: '/path/to/file.mp4',
        size: 1000000,
        quality: '1080p',
        dateAdded: '2024-01-01T00:00:00.000Z',
        relativePath: 'file.mp4',
      };
      await db.insert(schema.scenes).values(scene);
      await db.insert(schema.sceneFiles).values(file);

      // Act
      const result = await repository.getSceneFiles('sc1');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].filePath).toBe('/path/to/file.mp4');
    });

    it('should return empty array when no files', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'sc1' };
      await db.insert(schema.scenes).values(scene);

      // Act
      const result = await repository.getSceneFiles('sc1');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getEntityName', () => {
    it('should return performer name for performer entity', async () => {
      // Arrange
      const performer = { ...mockPerformerData.performer, id: 'p1', name: 'Jane Doe' };
      await db.insert(schema.performers).values(performer);

      // Act
      const result = await repository.getEntityName('performer', 'p1');

      // Assert
      expect(result).toBe('Jane Doe');
    });

    it('should return studio name for studio entity', async () => {
      // Arrange
      const studio = { ...mockStudioData.studio, id: 's1', name: 'Test Studio' };
      await db.insert(schema.studios).values(studio);

      // Act
      const result = await repository.getEntityName('studio', 's1');

      // Assert
      expect(result).toBe('Test Studio');
    });

    it('should return scene title for scene entity', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'sc1', title: 'Test Scene' };
      await db.insert(schema.scenes).values(scene);

      // Act
      const result = await repository.getEntityName('scene', 'sc1');

      // Assert
      expect(result).toBe('Test Scene');
    });

    it('should return entityId when entity not found', async () => {
      // Act
      const result = await repository.getEntityName('performer', 'non-existent');

      // Assert
      expect(result).toBe('non-existent');
    });
  });

  describe('getSceneRelationsCount', () => {
    it('should count performer relations', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'sc1' };
      const performer1 = { ...mockPerformerData.performer, id: 'p1' };
      const performer2 = { ...mockPerformerData.performer, id: 'p2' };
      await db.insert(schema.scenes).values(scene);
      await db.insert(schema.performers).values([performer1, performer2]);
      await db.insert(schema.performersScenes).values({ performerId: 'p1', sceneId: 'sc1' });
      await db.insert(schema.performersScenes).values({ performerId: 'p2', sceneId: 'sc1' });

      // Act
      const result = await repository.getSceneRelationsCount('sc1');

      // Assert
      expect(result.performers).toBe(2);
    });

    it('should count studio relations (0 or 1)', async () => {
      // Arrange
      const studio = { ...mockStudioData.studio, id: 's1' };
      const scene = { ...mockSceneData.scene, id: 'sc1', siteId: 's1' };
      await db.insert(schema.studios).values(studio);
      await db.insert(schema.scenes).values(scene);

      // Act
      const result = await repository.getSceneRelationsCount('sc1');

      // Assert
      expect(result.studios).toBe(1);
    });

    it('should return zero counts when scene not found', async () => {
      // Act
      const result = await repository.getSceneRelationsCount('non-existent');

      // Assert
      expect(result.performers).toBe(0);
      expect(result.studios).toBe(0);
    });
  });

  describe('updateSceneIsSubscribed', () => {
    it('should update isSubscribed field', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'sc1', isSubscribed: true };
      await db.insert(schema.scenes).values(scene);

      // Act
      await repository.updateSceneIsSubscribed('sc1', false);

      // Assert
      const updated = await db.query.scenes.findFirst({ where: (scenes, { eq }) => eq(scenes.id, 'sc1') });
      expect(updated?.isSubscribed).toBe(false);
    });
  });

  describe('deleteScene', () => {
    it('should delete scene from database', async () => {
      // Arrange
      const scene = { ...mockSceneData.scene, id: 'sc1' };
      await db.insert(schema.scenes).values(scene);

      // Act
      await repository.deleteScene('sc1');

      // Assert
      const deleted = await db.query.scenes.findFirst({ where: (scenes, { eq }) => eq(scenes.id, 'sc1') });
      expect(deleted).toBeUndefined();
    });
  });
});

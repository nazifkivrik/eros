export const mockSubscriptionData = {
  performerSubscription: {
    id: 'sub-performer-1',
    entityType: 'performer' as const,
    entityId: 'performer-1',
    qualityProfileId: 'quality-1',
    autoDownload: true,
    includeMetadataMissing: false,
    includeAliases: true,
    isSubscribed: true,
    searchCutoffDate: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  studioSubscription: {
    id: 'sub-studio-1',
    entityType: 'studio' as const,
    entityId: 'studio-1',
    qualityProfileId: 'quality-1',
    autoDownload: false,
    includeMetadataMissing: true,
    includeAliases: false,
    isSubscribed: true,
    searchCutoffDate: '2024-01-01T00:00:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  sceneSubscription: {
    id: 'sub-scene-1',
    entityType: 'scene' as const,
    entityId: 'scene-1',
    qualityProfileId: 'quality-1',
    autoDownload: true,
    includeMetadataMissing: false,
    includeAliases: false,
    isSubscribed: true,
    searchCutoffDate: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
};

export const mockQualityProfileData = {
  qualityProfile: {
    id: 'quality-1',
    name: '1080p',
    items: [
      {
        quality: '1080p',
        source: 'any',
        minSeeders: 'any' as const,
        maxSize: 8589934592, // 8GB
      },
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
};

import type {
  IMetadataProvider,
  MetadataScene,
  MetadataPerformer,
  MetadataStudio,
} from '@/infrastructure/adapters/interfaces/metadata-provider.interface.js';
import { vi } from 'vitest';

export function createMockMetadataProvider(config?: {
  scenes?: MetadataScene[];
  performers?: MetadataPerformer[];
  studios?: MetadataStudio[];
  testConnectionResult?: boolean;
}): IMetadataProvider {
  const mockScenes = config?.scenes ?? [];
  const mockPerformers = config?.performers ?? [];
  const mockStudios = config?.studios ?? [];
  const mockTestConnection = config?.testConnectionResult ?? true;

  return {
    name: 'MockMetadataProvider',
    searchPerformers: vi.fn().mockResolvedValue(mockPerformers),
    getPerformerById: vi.fn().mockImplementation(async (id: string) => {
      return mockPerformers.find((p) => p.id === id) || null;
    }),
    searchStudios: vi.fn().mockResolvedValue(mockStudios),
    getStudioById: vi.fn().mockImplementation(async (id: string) => {
      return mockStudios.find((s) => s.id === id) || null;
    }),
    searchScenes: vi.fn().mockResolvedValue(mockScenes),
    getSceneById: vi.fn().mockImplementation(async (id: string) => {
      return mockScenes.find((s) => s.id === id) || null;
    }),
    getPerformerScenes: vi.fn().mockResolvedValue({
      scenes: mockScenes,
      pagination: { total: mockScenes.length, page: 1, pageSize: 25 },
    }),
    getStudioScenes: vi.fn().mockResolvedValue({
      scenes: mockScenes,
      pagination: { total: mockScenes.length, page: 1, pageSize: 25 },
    }),
    getSceneByHash: vi.fn().mockResolvedValue(null),
    testConnection: vi.fn().mockResolvedValue(mockTestConnection),
    searchSites: vi.fn().mockResolvedValue({
      sites: mockStudios,
      pagination: { total: mockStudios.length, page: 1, pageSize: 25 },
    }),
  };
}

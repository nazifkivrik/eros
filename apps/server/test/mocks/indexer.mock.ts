import type {
  IIndexer,
  TorrentSearchResult,
} from '@/infrastructure/adapters/interfaces/indexer.interface.js';
import { vi } from 'vitest';

export function createMockIndexer(config?: {
  searchResults?: TorrentSearchResult[];
  testConnectionResult?: boolean;
}): IIndexer {
  const mockSearchResults = config?.searchResults ?? [];
  const mockTestConnection = config?.testConnectionResult ?? true;

  return {
    name: 'MockIndexer',
    search: vi.fn().mockResolvedValue(mockSearchResults),
    getIndexers: vi.fn().mockResolvedValue([]),
    testConnection: vi.fn().mockResolvedValue(mockTestConnection),
    syncIndexers: vi.fn().mockResolvedValue([]),
    getMagnetLink: vi.fn().mockResolvedValue(null),
  };
}

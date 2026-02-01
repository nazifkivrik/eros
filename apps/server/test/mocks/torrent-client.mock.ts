import type {
  ITorrentClient,
  TorrentInfo,
  TorrentProperties,
  AddTorrentOptions,
} from '@/infrastructure/adapters/interfaces/torrent-client.interface.js';
import { vi } from 'vitest';

export function createMockTorrentClient(config?: {
  torrents?: TorrentInfo[];
  addMagnetResult?: string | null;
  testConnectionResult?: boolean;
}): ITorrentClient {
  const mockTorrents = config?.torrents ?? [];
  const mockAddMagnetResult = config?.addMagnetResult ?? 'abc123';
  const mockTestConnection = config?.testConnectionResult ?? true;

  return {
    name: 'MockTorrentClient',
    getTorrents: vi.fn().mockResolvedValue(mockTorrents),
    getTorrentProperties: vi.fn().mockResolvedValue({
      savePath: '/downloads',
      contentPath: '/downloads/test',
      creationDate: Date.now(),
      pieceSize: 16384,
      comment: '',
      totalWasted: 0,
      totalUploaded: 0,
      totalUploadedSession: 0,
      totalDownloaded: 0,
      totalDownloadedSession: 0,
      upLimit: 0,
      dlLimit: 0,
      timeElapsed: 0,
      seedingTime: 0,
      nbConnections: 0,
      nbConnectionsLimit: 0,
      shareRatio: 0,
    } satisfies TorrentProperties),
    getTorrentInfo: vi.fn().mockImplementation(async (hash: string) => {
      return mockTorrents.find((t) => t.hash === hash) || null;
    }),
    addMagnet: vi.fn().mockResolvedValue(mockAddMagnetResult),
    setLocation: vi.fn().mockResolvedValue(true),
    addTorrent: vi.fn().mockResolvedValue(true),
    addTorrentAndGetHash: vi.fn().mockResolvedValue(mockAddMagnetResult),
    pauseTorrent: vi.fn().mockResolvedValue(true),
    resumeTorrent: vi.fn().mockResolvedValue(true),
    removeTorrent: vi.fn().mockResolvedValue(true),
    setSpeedLimit: vi.fn().mockResolvedValue(true),
    setTorrentPriority: vi.fn().mockResolvedValue(true),
    deleteTorrent: vi.fn().mockResolvedValue(true),
    setGlobalSpeedLimits: vi.fn().mockResolvedValue(true),
    testConnection: vi.fn().mockResolvedValue(mockTestConnection),
  };
}

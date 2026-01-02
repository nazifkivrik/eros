/**
 * Torrent type for qBittorrent integration
 */
export type Torrent = {
  hash: string;
  name: string;
  size: number;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  eta: number;
  ratio: number;
  state: string;
  category: string;
  savePath: string;
  addedOn: number;
  completionOn: number | null;
  seeders: number;
  leechers: number;
};

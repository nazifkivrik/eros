/**
 * Speed profile types for qBittorrent download/upload limiting
 */
export type SpeedProfileRule = {
  name: string;
  enabled: boolean;
  startHour: number;
  endHour: number;
  daysOfWeek: number[];
  downloadLimit: number | null;
  uploadLimit: number | null;
};

export type SpeedProfileSettings = {
  enabled: boolean;
  rules: SpeedProfileRule[];
  defaultDownloadLimit: number | null;
  defaultUploadLimit: number | null;
};

/**
 * Speed Profile Settings
 * Manages time-based download/upload speed limits for torrents
 * Uses a weekly calendar with hourly slots
 */

/**
 * A speed profile with configurable limits and color
 */
export type SpeedProfile = {
  id: string;
  name: string; // e.g., "Daytime", "Night", "Unlimited"
  color: string; // Hex color for calendar UI, e.g., "#3b82f6"
  downloadLimit: number; // KB/s, 0 = unlimited
  uploadLimit: number; // KB/s, 0 = unlimited
};

/**
 * A single time slot mapped to a speed profile
 * 168 slots total (7 days × 24 hours)
 */
export type SpeedScheduleSlot = {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23
  speedProfileId: string;
};

/**
 * Complete speed schedule settings
 */
export type SpeedScheduleSettings = {
  enabled: boolean;
  profiles: SpeedProfile[];
  schedule: SpeedScheduleSlot[]; // 168 slots for full week
};

/**
 * Default speed profile settings
 */
export const DEFAULT_SPEED_SCHEDULE_SETTINGS: SpeedScheduleSettings = {
  enabled: false,
  profiles: [
    {
      id: "default",
      name: "Unlimited",
      color: "#22c55e", // green
      downloadLimit: 0,
      uploadLimit: 0,
    },
  ],
  // All slots default to "unlimited" profile
  schedule: Array.from({ length: 168 }, (_, i) => ({
    dayOfWeek: Math.floor(i / 24),
    hour: i % 24,
    speedProfileId: "default",
  })),
};

/**
 * Get speed profile for current time
 */
export function getActiveSpeedProfile(
  settings: SpeedScheduleSettings
): SpeedProfile | null {
  if (!settings.enabled) {
    return null;
  }

  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  const slot = settings.schedule.find(
    (s) => s.dayOfWeek === currentDay && s.hour === currentHour
  );

  if (!slot) {
    return null;
  }

  return settings.profiles.find((p) => p.id === slot.speedProfileId) || null;
}

/**
 * Get slot index for day and hour
 */
export function getSlotIndex(dayOfWeek: number, hour: number): number {
  return dayOfWeek * 24 + hour;
}

/**
 * Get day and hour from slot index
 */
export function getSlotFromIndex(index: number): { dayOfWeek: number; hour: number } {
  return {
    dayOfWeek: Math.floor(index / 24),
    hour: index % 24,
  };
}

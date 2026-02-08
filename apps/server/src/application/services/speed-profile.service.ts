/**
 * Speed Profile Service
 * Manages time-based download/upload speed limits for torrents
 * Uses a weekly calendar with 168 hourly slots (7 days × 24 hours)
 */

import type { SpeedScheduleSettings, SpeedProfile } from "@repo/shared-types";
import { getActiveSpeedProfile } from "@repo/shared-types";
import type { Logger } from "pino";

/**
 * Result of getting active speed limits
 */
export type ActiveSpeedLimits = {
  downloadLimit: number; // KB/s, 0 = unlimited
  uploadLimit: number; // KB/s, 0 = unlimited
  profileName?: string;
};

export class SpeedProfileService {
  private settings: SpeedScheduleSettings;
  private logger: Logger;

  constructor(logger: Logger, speedScheduleSettings?: SpeedScheduleSettings) {
    this.logger = logger;
    this.settings = speedScheduleSettings || this.getDefaultSettings();
  }

  /**
   * Get default speed schedule settings
   */
  private getDefaultSettings(): SpeedScheduleSettings {
    return {
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
      schedule: Array.from({ length: 168 }, (_, i) => ({
        dayOfWeek: Math.floor(i / 24),
        hour: i % 24,
        speedProfileId: "default",
      })),
    };
  }

  /**
   * Update speed schedule settings
   */
  updateSettings(settings: SpeedScheduleSettings): void {
    this.settings = settings;
    this.logger.info({ settings }, "Speed schedule settings updated");
  }

  /**
   * Get current speed schedule settings
   */
  getSettings(): SpeedScheduleSettings {
    return this.settings;
  }

  /**
   * Get active speed limits for current time
   */
  getActiveSpeedLimits(): ActiveSpeedLimits {
    if (!this.settings.enabled) {
      return {
        downloadLimit: 0,
        uploadLimit: 0,
      };
    }

    const profile = getActiveSpeedProfile(this.settings);

    if (profile) {
      return {
        downloadLimit: profile.downloadLimit,
        uploadLimit: profile.uploadLimit,
        profileName: profile.name,
      };
    }

    // No matching profile, return unlimited
    return {
      downloadLimit: 0,
      uploadLimit: 0,
    };
  }

  /**
   * Enable/disable speed scheduling
   */
  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    this.logger.info({ enabled }, `Speed scheduling ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Get formatted speed limit string for logging
   */
  formatSpeedLimits(limits: ActiveSpeedLimits): string {
    const dl =
      limits.downloadLimit === 0
        ? "unlimited"
        : `${Math.round(limits.downloadLimit / 1024)} MB/s`;
    const ul =
      limits.uploadLimit === 0
        ? "unlimited"
        : `${Math.round(limits.uploadLimit / 1024)} MB/s`;

    if (limits.profileName) {
      return `${limits.profileName}: ↓${dl} ↑${ul}`;
    }

    return `Default: ↓${dl} ↑${ul}`;
  }

  /**
   * Add a new speed profile
   */
  addProfile(profile: Omit<SpeedProfile, "id">): SpeedProfile {
    const newProfile: SpeedProfile = {
      ...profile,
      id: `profile-${Date.now()}`,
    };
    this.settings.profiles.push(newProfile);
    this.logger.info({ profile: newProfile }, "Speed profile added");
    return newProfile;
  }

  /**
   * Update an existing speed profile
   */
  updateProfile(id: string, updates: Partial<SpeedProfile>): boolean {
    const index = this.settings.profiles.findIndex((p) => p.id === id);
    if (index === -1) {
      return false;
    }
    this.settings.profiles[index] = { ...this.settings.profiles[index], ...updates };
    this.logger.info({ id, updates }, "Speed profile updated");
    return true;
  }

  /**
   * Delete a speed profile
   */
  deleteProfile(id: string): boolean {
    const index = this.settings.profiles.findIndex((p) => p.id === id);
    if (index === -1) {
      return false;
    }
    this.settings.profiles.splice(index, 1);
    // Reset any slots using this profile to use the first available profile
    const fallbackProfileId = this.settings.profiles[0]?.id || "default";
    this.settings.schedule = this.settings.schedule.map((slot) =>
      slot.speedProfileId === id ? { ...slot, speedProfileId: fallbackProfileId } : slot
    );
    this.logger.info({ id }, "Speed profile deleted");
    return true;
  }

  /**
   * Update schedule slots
   */
  updateScheduleSlot(dayOfWeek: number, hour: number, speedProfileId: string): void {
    const slot = this.settings.schedule.find(
      (s) => s.dayOfWeek === dayOfWeek && s.hour === hour
    );
    if (slot) {
      slot.speedProfileId = speedProfileId;
    }
  }

  /**
   * Bulk update schedule slots (e.g., for "apply weekday preset")
   */
  updateScheduleSlots(slots: Array<{ dayOfWeek: number; hour: number; speedProfileId: string }>): void {
    for (const slot of slots) {
      this.updateScheduleSlot(slot.dayOfWeek, slot.hour, slot.speedProfileId);
    }
    this.logger.info({ count: slots.length }, "Schedule slots updated");
  }
}

// Singleton instance
let speedProfileServiceInstance: SpeedProfileService | null = null;

export function createSpeedProfileService(
  logger: Logger,
  speedScheduleSettings?: SpeedScheduleSettings
): SpeedProfileService {
  if (!speedProfileServiceInstance) {
    speedProfileServiceInstance = new SpeedProfileService(logger, speedScheduleSettings);
  } else if (speedScheduleSettings) {
    speedProfileServiceInstance.updateSettings(speedScheduleSettings);
  }
  return speedProfileServiceInstance;
}

export function getSpeedProfileService(): SpeedProfileService | null {
  return speedProfileServiceInstance;
}

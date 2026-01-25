/**
 * Speed Profile Service
 * Manages time-based download/upload speed limits for torrents
 */

export type SpeedProfileRule = {
  name: string;
  enabled: boolean;
  // Time range (24-hour format)
  startHour: number; // 0-23
  endHour: number; // 0-23
  // Days of week (0 = Sunday, 6 = Saturday)
  daysOfWeek: number[]; // [0,1,2,3,4,5,6] for all days
  // Speed limits in KB/s (0 = unlimited)
  downloadLimit: number;
  uploadLimit: number;
};

export type SpeedProfileSettings = {
  enabled: boolean;
  rules: SpeedProfileRule[];
  defaultDownloadLimit: number; // Default when no rule matches
  defaultUploadLimit: number;
};

export class SpeedProfileService {
  private settings: SpeedProfileSettings;

  constructor(speedProfileSettings?: SpeedProfileSettings) {
    this.settings = speedProfileSettings || this.getDefaultSettings();
  }

  /**
   * Get default speed profile settings
   */
  private getDefaultSettings(): SpeedProfileSettings {
    return {
      enabled: false,
      defaultDownloadLimit: 0, // Unlimited
      defaultUploadLimit: 0, // Unlimited
      rules: [
        {
          name: "Daytime (Slow)",
          enabled: true,
          startHour: 8,
          endHour: 22,
          daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
          downloadLimit: 1024, // 1 MB/s
          uploadLimit: 256, // 256 KB/s
        },
        {
          name: "Nighttime (Fast)",
          enabled: true,
          startHour: 22,
          endHour: 8,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // All days
          downloadLimit: 0, // Unlimited
          uploadLimit: 512, // 512 KB/s
        },
        {
          name: "Weekend (Medium)",
          enabled: true,
          startHour: 8,
          endHour: 22,
          daysOfWeek: [0, 6], // Sunday, Saturday
          downloadLimit: 2048, // 2 MB/s
          uploadLimit: 512, // 512 KB/s
        },
      ],
    };
  }

  /**
   * Update speed profile settings
   */
  updateSettings(settings: SpeedProfileSettings): void {
    this.settings = settings;
  }

  /**
   * Get current speed profile settings
   */
  getSettings(): SpeedProfileSettings {
    return this.settings;
  }

  /**
   * Get active speed limits for current time
   */
  getActiveSpeedLimits(): {
    downloadLimit: number;
    uploadLimit: number;
    ruleName?: string;
  } {
    if (!this.settings.enabled) {
      return {
        downloadLimit: this.settings.defaultDownloadLimit,
        uploadLimit: this.settings.defaultUploadLimit,
      };
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    // Find matching rule (first match wins)
    const matchingRule = this.findMatchingRule(currentHour, currentDay);

    if (matchingRule) {
      return {
        downloadLimit: matchingRule.downloadLimit,
        uploadLimit: matchingRule.uploadLimit,
        ruleName: matchingRule.name,
      };
    }

    // No matching rule, use defaults
    return {
      downloadLimit: this.settings.defaultDownloadLimit,
      uploadLimit: this.settings.defaultUploadLimit,
    };
  }

  /**
   * Find matching speed profile rule for given time
   */
  private findMatchingRule(
    hour: number,
    dayOfWeek: number
  ): SpeedProfileRule | null {
    const enabledRules = this.settings.rules.filter((rule) => rule.enabled);

    for (const rule of enabledRules) {
      // Check if day matches
      if (!rule.daysOfWeek.includes(dayOfWeek)) {
        continue;
      }

      // Check if hour matches (handle wraparound for overnight rules)
      if (this.isHourInRange(hour, rule.startHour, rule.endHour)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Check if hour is within time range (handles overnight ranges)
   */
  private isHourInRange(
    hour: number,
    startHour: number,
    endHour: number
  ): boolean {
    if (startHour <= endHour) {
      // Normal range (e.g., 8-17)
      return hour >= startHour && hour < endHour;
    } else {
      // Overnight range (e.g., 22-8)
      return hour >= startHour || hour < endHour;
    }
  }

  /**
   * Add a new speed profile rule
   */
  addRule(rule: SpeedProfileRule): void {
    this.settings.rules.push(rule);
  }

  /**
   * Remove a speed profile rule by name
   */
  removeRule(ruleName: string): void {
    this.settings.rules = this.settings.rules.filter(
      (rule) => rule.name !== ruleName
    );
  }

  /**
   * Update a specific rule
   */
  updateRule(ruleName: string, updatedRule: SpeedProfileRule): void {
    const index = this.settings.rules.findIndex(
      (rule) => rule.name === ruleName
    );
    if (index !== -1) {
      this.settings.rules[index] = updatedRule;
    }
  }

  /**
   * Enable/disable speed profiling
   */
  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
  }

  /**
   * Get formatted speed limit string for logging
   */
  formatSpeedLimits(limits: {
    downloadLimit: number;
    uploadLimit: number;
    ruleName?: string;
  }): string {
    const dl =
      limits.downloadLimit === 0
        ? "unlimited"
        : `${Math.round(limits.downloadLimit / 1024)} MB/s`;
    const ul =
      limits.uploadLimit === 0
        ? "unlimited"
        : `${Math.round(limits.uploadLimit / 1024)} MB/s`;

    if (limits.ruleName) {
      return `${limits.ruleName}: ↓${dl} ↑${ul}`;
    }

    return `Default: ↓${dl} ↑${ul}`;
  }
}

// Singleton instance
let speedProfileServiceInstance: SpeedProfileService | null = null;

export function createSpeedProfileService(
  speedProfileSettings?: SpeedProfileSettings
): SpeedProfileService {
  if (!speedProfileServiceInstance) {
    speedProfileServiceInstance = new SpeedProfileService(speedProfileSettings);
  } else if (speedProfileSettings) {
    speedProfileServiceInstance.updateSettings(speedProfileSettings);
  }
  return speedProfileServiceInstance;
}

export function getSpeedProfileService(): SpeedProfileService | null {
  return speedProfileServiceInstance;
}

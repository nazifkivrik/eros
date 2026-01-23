/**
 * Date extraction utilities for scene matching
 * Extracts dates from torrent titles and calculates date similarity for disambiguation
 */

export class DateExtractor {
  /**
   * Extract date from torrent title
   * Supports multiple common date formats
   */
  static extractDate(title: string): Date | null {
    // Try different date patterns in order of specificity
    const patterns = [
      // YYYY-MM-DD (most specific, preferred)
      {
        regex: /\b(20\d{2})[-._](0[1-9]|1[0-2])[-._](0[1-9]|[12]\d|3[01])\b/,
        format: (match: RegExpMatchArray) => new Date(`${match[1]}-${match[2]}-${match[3]}`),
      },
      // DD-MM-YYYY or DD.MM.YYYY
      {
        regex: /\b(0[1-9]|[12]\d|3[01])[-._](0[1-9]|1[0-2])[-._](20\d{2})\b/,
        format: (match: RegExpMatchArray) => new Date(`${match[3]}-${match[2]}-${match[1]}`),
      },
      // YYYYMMDD (compact format)
      {
        regex: /\b(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/,
        format: (match: RegExpMatchArray) => new Date(`${match[1]}-${match[2]}-${match[3]}`),
      },
      // YY-MM-DD (2-digit year)
      {
        regex: /\b(\d{2})[-._](0[1-9]|1[0-2])[-._](0[1-9]|[12]\d|3[01])\b/,
        format: (match: RegExpMatchArray) => {
          const year = parseInt(match[1]) >= 50 ? `19${match[1]}` : `20${match[1]}`;
          return new Date(`${year}-${match[2]}-${match[3]}`);
        },
      },
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern.regex);
      if (match) {
        try {
          const date = pattern.format(match);
          // Validate the date is reasonable (not in future, not before 1980)
          const now = new Date();
          const minDate = new Date("1980-01-01");
          if (date <= now && date >= minDate) {
            return date;
          }
        } catch {
          // Invalid date, continue to next pattern
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Calculate date similarity (0-1 scale)
   * Returns higher values for dates that are closer together
   *
   * Scoring:
   * - Exact match: 1.0
   * - Within 7 days: 0.95
   * - Within 30 days: 0.8
   * - Within 90 days: 0.6
   * - Within 180 days: 0.4
   * - Within 365 days: 0.2
   * - More than a year: 0.0
   */
  static calculateDateSimilarity(date1: Date, date2: Date): number {
    const daysDiff = Math.abs(this.daysBetween(date1, date2));

    if (daysDiff === 0) return 1.0; // Exact match
    if (daysDiff <= 7) return 0.95; // Within a week
    if (daysDiff <= 30) return 0.8; // Within a month
    if (daysDiff <= 90) return 0.6; // Within 3 months
    if (daysDiff <= 180) return 0.4; // Within 6 months
    if (daysDiff <= 365) return 0.2; // Within a year
    return 0.0; // More than a year apart
  }

  /**
   * Check if dates match within a tolerance (in days)
   */
  static datesMatchWithinTolerance(date1: Date, date2: Date, toleranceDays = 7): boolean {
    return Math.abs(this.daysBetween(date1, date2)) <= toleranceDays;
  }

  /**
   * Calculate number of days between two dates
   */
  private static daysBetween(date1: Date, date2: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return Math.floor((utc2 - utc1) / msPerDay);
  }

  /**
   * Parse ISO date string to Date object
   * Handles null and invalid dates gracefully
   */
  static parseISODate(dateString: string | null): Date | null {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Get date bonus score for matching
   * Returns 0-5 points to add to match score based on date proximity
   */
  static getDateBonus(torrentDate: Date | null, sceneDate: string | null): number {
    if (!torrentDate || !sceneDate) return 0;

    const sceneDateObj = this.parseISODate(sceneDate);
    if (!sceneDateObj) return 0;

    const similarity = this.calculateDateSimilarity(torrentDate, sceneDateObj);

    // Convert similarity to bonus points (0-5)
    if (similarity >= 0.95) return 5; // Exact or within a week
    if (similarity >= 0.8) return 3; // Within a month
    if (similarity >= 0.6) return 2; // Within 3 months
    if (similarity >= 0.4) return 1; // Within 6 months
    return 0;
  }
}

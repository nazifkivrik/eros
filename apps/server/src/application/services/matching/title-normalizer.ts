/**
 * Title normalization utilities for consistent scene matching
 */

export class TitleNormalizer {
  /**
   * Normalize a title for comparison
   * - Converts to lowercase
   * - Removes special characters
   * - Collapses whitespace
   */
  static normalize(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, " ") // Replace special chars with spaces
      .replace(/\s+/g, " ") // Collapse multiple spaces
      .trim();
  }

  /**
   * Extract core scene title by removing metadata
   * This is the main title cleaning method extracted from torrent-search.service.ts
   */
  static extractCoreTitle(title: string): string {
    let cleaned = title;

    // Remove everything after common spam indicators
    cleaned = cleaned.replace(
      /\s+(want more|watch and download|get of accounts|backup\/latest|to watch video|#hd|#in).*/gi,
      ""
    );

    // Remove telegram links
    cleaned = cleaned.replace(/t\.me\/[^\s]+/gi, "");

    // Remove URLs (http://, https://, ftp://, or domain-like patterns)
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, "");
    cleaned = cleaned.replace(/ftp:\/\/[^\s]+/gi, "");
    cleaned = cleaned.replace(/www\.[^\s]+/gi, "");
    cleaned = cleaned.replace(
      /[a-z0-9-]+\.(com|net|org|io|to|cc|tv|xxx|html)[^\s]*/gi,
      ""
    );

    // Remove common streaming/download sites
    cleaned = cleaned.replace(
      /\b(savefiles|lulustream|doodstream|streamtape|bigwarp)\.[\w\/]+/gi,
      ""
    );

    // Remove arrow symbols and common spam indicators
    cleaned = cleaned.replace(/[-=]>/g, " ");
    cleaned = cleaned.replace(/<[-=]/g, " ");
    cleaned = cleaned.replace(/\\r\\n|\\n/g, " ");

    // Remove platform prefixes (OnlyFans, ManyVids, etc.)
    cleaned = cleaned.replace(
      /\b(onlyfans|manyvids|fansly|patreon|fancentro|pornhub|xvideos|chaturbate|cam4|myfreecams|mfc|streamate|mrluckyraw|tagteampov|baddiesonlypov)[-\s]*/gi,
      ""
    );

    // Remove spam keywords
    cleaned = cleaned.replace(
      /\b(new|full|xxx|nsfw|leaked|exclusive|premium|vip|hot|sexy|latest|hd|rq)\b/gi,
      ""
    );

    // Remove date patterns (DD MM YY, YYYY MM DD, 25 10 10, etc.)
    cleaned = cleaned.replace(/\b\d{2}\s+\d{2}\s+\d{2}\b/g, "");
    cleaned = cleaned.replace(/\b\d{4}\s+\d{2}\s+\d{2}\b/g, "");
    cleaned = cleaned.replace(/\b(19|20)\d{2}[-_.]\d{2}[-_.]\d{2}\b/g, "");
    cleaned = cleaned.replace(/\b(19|20)\d{2}\b/g, ""); // Remove year

    // Remove quality indicators
    cleaned = cleaned.replace(/\b(2160p|1080p|720p|480p|4k|uhd|hd|sd)\b/gi, "");

    // Remove source indicators
    cleaned = cleaned.replace(
      /\b(web-?dl|webrip|bluray|blu-ray|hdtv|dvdrip|bdrip|brrip)\b/gi,
      ""
    );

    // Remove codec indicators
    cleaned = cleaned.replace(
      /\b(h\.?264|h\.?265|x264|x265|hevc|avc|mpeg|divx|xvid)\b/gi,
      ""
    );

    // Remove audio indicators
    cleaned = cleaned.replace(
      /\b(aac|ac3|dts|flac|mp3|dd5\.1|dd2\.0|atmos)\b/gi,
      ""
    );

    // Remove file formats
    cleaned = cleaned.replace(
      /\b(mp4|mkv|avi|wmv|mov|flv|m4v|ts|mpg|mpeg)\b/gi,
      ""
    );

    // Remove release group (usually in brackets or parentheses)
    cleaned = cleaned.replace(/\[.*?\]/g, "");
    cleaned = cleaned.replace(/\(.*?\)/g, "");

    // Remove file size indicators
    cleaned = cleaned.replace(/\b\d+(\.\d+)?\s?(gb|mb|gib|mib)\b/gi, "");

    // Remove scene numbering patterns (E55, S01E02, etc.)
    cleaned = cleaned.replace(/\b(s\d{2}e\d{2}|e\d{2,3})\b/gi, "");

    // Remove common release tags
    cleaned = cleaned.replace(
      /\b(repack|proper|real|retail|extended|unrated|directors?\.cut|remastered|xleech|p2p|xc)\b/gi,
      ""
    );

    // Remove escaped quotes
    cleaned = cleaned.replace(/\\"/g, '"');

    // Remove multiple dashes, underscores, dots
    cleaned = cleaned.replace(/[-_.]{2,}/g, " ");

    // Clean up extra spaces and trim
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    // Remove leading/trailing special characters
    cleaned = cleaned.replace(/^[-_.,"]+|[-_.,"]+$/g, "");

    return cleaned || title; // Fallback to original if cleaning resulted in empty string
  }

  /**
   * Remove metadata and normalize for matching
   * Combines extractCoreTitle and normalize
   */
  static removeMetadata(title: string): string {
    return this.normalize(this.extractCoreTitle(title));
  }

  /**
   * Tokenize a title into words for analysis
   */
  static tokenize(title: string): string[] {
    return this.normalize(title)
      .split(/\s+/)
      .filter((word) => word.length > 0);
  }

  /**
   * Calculate length ratio between two titles
   * Returns ratio of shorter to longer (0-1)
   */
  static lengthRatio(title1: string, title2: string): number {
    const len1 = title1.length;
    const len2 = title2.length;
    if (len1 === 0 || len2 === 0) return 0;
    return Math.min(len1, len2) / Math.max(len1, len2);
  }

  /**
   * Check if one title is substantially contained in another
   */
  static isPartialMatch(shorter: string, longer: string, minLength = 20): boolean {
    return shorter.length >= minLength && longer.startsWith(shorter);
  }
}

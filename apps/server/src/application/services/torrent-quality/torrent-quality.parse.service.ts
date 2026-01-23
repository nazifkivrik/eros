/**
 * Torrent Quality Parse Service
 * Handles parsing of torrent titles to extract quality and source information
 *
 * Responsibilities:
 * - Quality detection from titles
 * - Source detection from titles
 * - Codec detection (optional)
 * - Audio detection (optional)
 */

/**
 * Torrent Quality Parse Service
 */
export class TorrentQualityParseService {
  /**
   * Parse quality from torrent title
   */
  parseQuality(title: string): { quality: string; source: string } {
    const titleLower = title.toLowerCase();

    // Detect quality
    let quality = "any";
    if (/2160p|4k|uhd/.test(titleLower)) {
      quality = "2160p";
    } else if (/1080p/.test(titleLower)) {
      quality = "1080p";
    } else if (/720p/.test(titleLower)) {
      quality = "720p";
    } else if (/480p/.test(titleLower)) {
      quality = "480p";
    }

    // Detect source
    let source = "any";
    if (/bluray|blu-ray|bdrip|brrip/.test(titleLower)) {
      source = "bluray";
    } else if (/web-?dl/.test(titleLower)) {
      source = "webdl";
    } else if (/webrip|web-?rip/.test(titleLower)) {
      source = "webrip";
    } else if (/hdtv/.test(titleLower)) {
      source = "hdtv";
    } else if (/dvd|dvdrip/.test(titleLower)) {
      source = "dvd";
    }

    return { quality, source };
  }

  /**
   * Detect quality from torrent title (standalone method)
   */
  detectQuality(title: string): string {
    const titleLower = title.toLowerCase();
    if (titleLower.includes("2160p") || titleLower.includes("4k"))
      return "2160p";
    if (titleLower.includes("1080p")) return "1080p";
    if (titleLower.includes("720p")) return "720p";
    if (titleLower.includes("480p")) return "480p";
    return "Unknown";
  }

  /**
   * Detect source from torrent title (standalone method)
   */
  detectSource(title: string): string {
    const titleLower = title.toLowerCase();
    if (titleLower.includes("web-dl") || titleLower.includes("webdl"))
      return "WEB-DL";
    if (titleLower.includes("webrip")) return "WEBRip";
    if (titleLower.includes("bluray") || titleLower.includes("blu-ray"))
      return "BluRay";
    if (titleLower.includes("hdtv")) return "HDTV";
    return "Unknown";
  }

  /**
   * Extended parsing with codec and audio information
   */
  parseExtended(title: string): {
    quality: string;
    source: string;
    codec?: string;
    audio?: string;
  } {
    const baseResult = this.parseQuality(title);
    const titleLower = title.toLowerCase();

    // Detect codec
    let codec: string | undefined;
    if (/h\.?264|avc|x264/.test(titleLower)) {
      codec = "h264";
    } else if (/h\.?265|hevc|x265/.test(titleLower)) {
      codec = "h265";
    }

    // Detect audio
    let audio: string | undefined;
    if (/aac/.test(titleLower)) {
      audio = "aac";
    } else if (/dts/.test(titleLower)) {
      audio = "dts";
    } else if (/ddp?|dolby.?digital/.test(titleLower)) {
      audio = "dd";
    } else if (/atmos/.test(titleLower)) {
      audio = "atmos";
    }

    return {
      ...baseResult,
      codec,
      audio,
    };
  }

  /**
   * Parse size string to bytes
   */
  parseSize(sizeStr: string): number {
    const match = sizeStr.toLowerCase().match(/^([\d.]+)\s*(gb|mb|kb)?$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2] || "bytes";

    switch (unit) {
      case "gb":
        return value * 1024 * 1024 * 1024;
      case "mb":
        return value * 1024 * 1024;
      case "kb":
        return value * 1024;
      default:
        return value;
    }
  }

  /**
   * Format bytes to human readable size
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }
}

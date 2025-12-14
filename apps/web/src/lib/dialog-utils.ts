/**
 * Formats a date string to localized date format
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Formats duration in seconds to minutes
 */
export function formatDuration(seconds: number | null): string {
  if (!seconds) return "Unknown";
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min`;
}

/**
 * File size formatting, filename utilities.
 */

/** Format bytes into a human-readable string (KB, MB, GB, etc.). */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Truncate a filename to a maximum length, preserving the extension. */
export function truncateFilename(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx === -1) {
    return name.slice(0, maxLen - 1) + "…";
  }
  const ext = name.slice(dotIdx); // e.g. ".png"
  const base = name.slice(0, dotIdx);
  const availableLen = maxLen - ext.length - 1; // 1 for the ellipsis
  if (availableLen <= 0) return name.slice(0, maxLen - 1) + "…";
  return base.slice(0, availableLen) + "…" + ext;
}

/** Get the file extension from a filename (without the dot, lowercase). */
export function getFileExtension(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  if (dotIdx === -1 || dotIdx === filename.length - 1) return "";
  return filename.slice(dotIdx + 1).toLowerCase();
}

/** Format a total size from an array of sizes. */
export function totalSize(sizes: number[]): number {
  return sizes.reduce((a, b) => a + b, 0);
}

/** Format a date string to a human-readable relative or absolute format. */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

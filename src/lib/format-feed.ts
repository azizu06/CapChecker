/** Format a duration in seconds as `m:ss` or `h:mm:ss`. */
export const formatDuration = (durationSeconds: number | null): string => {
  if (durationSeconds === null || !Number.isFinite(durationSeconds)) return "";
  const total = Math.max(0, Math.floor(durationSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const paddedSeconds = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
};

const checkedFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Deterministic absolute date for a "last checked" label. Rendered in UTC so
 * server and client markup match and hydration stays stable.
 */
export const formatCheckedAt = (isoTimestamp: string): string =>
  checkedFormatter.format(new Date(isoTimestamp));

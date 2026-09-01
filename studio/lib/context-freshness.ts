export function isContextItemStale(sourceLastUpdatedAt: string | null): boolean {
  if (!sourceLastUpdatedAt) return true;
  const updatedAt = new Date(sourceLastUpdatedAt);
  if (Number.isNaN(updatedAt.getTime())) return true;
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  return Date.now() - updatedAt.getTime() >= oneYearMs;
}

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60_000;

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached(key: string, value: unknown, ttlMs = DEFAULT_TTL_MS): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function getCacheStats() {
  return { entries: cache.size, now: new Date().toISOString() };
}

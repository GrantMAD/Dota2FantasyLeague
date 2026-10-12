interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 500;

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.value as T;
}

export function setCached(key: string, value: unknown, ttlMs = DEFAULT_TTL_MS): void {
  const now = Date.now();
  for (const [cachedKey, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(cachedKey);
  }
  cache.delete(key);
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const leastRecentlyUsedKey = cache.keys().next().value;
    if (leastRecentlyUsedKey === undefined) break;
    cache.delete(leastRecentlyUsedKey);
  }
  cache.set(key, { value, expiresAt: now + ttlMs });
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

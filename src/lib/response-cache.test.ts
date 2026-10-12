import { getCached, getCacheStats, invalidateCache, setCached } from './response-cache';

describe('response cache', () => {
  beforeEach(() => {
    invalidateCache();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-12T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('expires entries when their TTL has elapsed', () => {
    setCached('short-lived', { value: 1 }, 1_000);
    expect(getCached('short-lived')).toEqual({ value: 1 });

    jest.advanceTimersByTime(1_000);

    expect(getCached('short-lived')).toBeNull();
    expect(getCacheStats().entries).toBe(0);
  });

  it('evicts the least recently used entry when the cache reaches its limit', () => {
    for (let index = 0; index < 500; index += 1) {
      setCached(`key-${index}`, index);
    }
    expect(getCached<number>('key-0')).toBe(0);

    setCached('overflow', 500);

    expect(getCacheStats().entries).toBe(500);
    expect(getCached<number>('key-1')).toBeNull();
    expect(getCached<number>('key-0')).toBe(0);
    expect(getCached<number>('overflow')).toBe(500);
  });

  it('purges expired entries when inserting a new entry', () => {
    setCached('expired', 'old', 10);
    jest.advanceTimersByTime(10);

    setCached('fresh', 'new');

    expect(getCacheStats().entries).toBe(1);
    expect(getCached('expired')).toBeNull();
    expect(getCached('fresh')).toBe('new');
  });
});

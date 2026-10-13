/// <reference types="jest" />

import { OpenDotaProvider } from '@/lib/data-providers/opendota-provider';

describe('OpenDota health check', () => {
  afterEach(() => jest.restoreAllMocks());

  it('probes the API health endpoint rather than assuming availability', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 })
    );
    const provider = new OpenDotaProvider({ apiUrl: 'https://opendota.example/api' });

    await expect(provider.healthCheck()).resolves.toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://opendota.example/api/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('reports an unhealthy or unreachable endpoint as unavailable', async () => {
    const provider = new OpenDotaProvider();
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('unavailable', { status: 503 }));
    await expect(provider.healthCheck()).resolves.toBe(false);

    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network failure'));
    await expect(provider.healthCheck()).resolves.toBe(false);
  });

  it('reports quota values as unavailable when OpenDota does not expose measurements', async () => {
    const provider = new OpenDotaProvider();

    await expect(provider.getRateLimitStatus()).resolves.toEqual({
      remaining: null,
      limit: null,
      resetAt: null,
    });
  });

  it('reserves spaced request slots for concurrent calls on the same provider instance', async () => {
    const requestTimes: number[] = [];
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      requestTimes.push(Date.now());
      return new Response('[]', { status: 200 });
    });
    const intervalMs = 25;
    const provider = new OpenDotaProvider({
      apiUrl: 'https://opendota.example/api',
      rateLimit: { requestsPerMinute: 60_000 / intervalMs },
    });

    await Promise.all([provider.fetchTeams(), provider.fetchTeams(), provider.fetchTeams()]);

    expect(requestTimes).toHaveLength(3);
    expect(requestTimes[1] - requestTimes[0]).toBeGreaterThanOrEqual(intervalMs - 2);
    expect(requestTimes[2] - requestTimes[1]).toBeGreaterThanOrEqual(intervalMs - 2);
  });
});

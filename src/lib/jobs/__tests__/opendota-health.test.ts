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
});

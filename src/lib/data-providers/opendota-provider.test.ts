import { OpenDotaProvider } from './opendota-provider';

describe('OpenDotaProvider.fetchTournaments', () => {
  const originalFetch = global.fetch;
  const now = Date.UTC(2026, 10, 13);

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('uses the latest observed match to determine activity and the inferred end date', async () => {
    const matches = [
      {
        match_id: 1,
        leagueid: 20486,
        league_name: '1win Essence III',
        start_time: Math.floor((now - 24 * 60 * 60 * 1000) / 1000),
      },
      {
        match_id: 2,
        leagueid: 20486,
        league_name: '1win Essence III',
        start_time: Math.floor((now - 2 * 24 * 60 * 60 * 1000) / 1000),
      },
      {
        match_id: 3,
        leagueid: 12345,
        league_name: 'Old tournament',
        start_time: Math.floor((now - 20 * 24 * 60 * 60 * 1000) / 1000),
      },
    ];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => matches,
    } as Response);

    const tournaments = await new OpenDotaProvider().fetchTournaments();

    expect(tournaments).toHaveLength(2);
    expect(tournaments[0]).toMatchObject({
      id: '20486',
      name: '1win Essence III',
      status: 'active',
    });
    expect(tournaments[0].startDate).toEqual(new Date((now - 2 * 24 * 60 * 60 * 1000)));
    expect(tournaments[0].endDate).toEqual(new Date(now + 13 * 24 * 60 * 60 * 1000));
    expect(tournaments[1].status).toBe('concluded');
  });

  it('fails fast on Cloudflare origin errors (HTTP 520-527) without retrying', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 521,
      statusText: 'Web Server Is Down',
    } as Response);

    const provider = new OpenDotaProvider();
    await expect(provider.fetchTournaments()).rejects.toMatchObject({
      code: 'OPENDOTA_TOURNAMENTS_FETCH_FAILED',
      statusCode: 521,
      retryable: false,
    });

    // Exactly 1 call: no retry attempts for Cloudflare origin downtime
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('treats generic HTTP 500 errors as retryable', async () => {
    jest.spyOn(global, 'setTimeout').mockImplementation((cb: unknown) => {
      if (typeof cb === 'function') cb();
      return 0 as unknown as NodeJS.Timeout;
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    const provider = new OpenDotaProvider();
    await expect(provider.fetchTournaments()).rejects.toMatchObject({
      code: 'OPENDOTA_TOURNAMENTS_FETCH_FAILED',
      statusCode: 500,
      retryable: true,
    });

    // Retried 3 times
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});

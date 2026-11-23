const mockSyncPlayers = jest.fn();

jest.mock('@/lib/db/supabase-server', () => ({
  getSupabaseServerClient: () => ({
    from: () => ({
      insert: async () => ({ error: null }),
    }),
  }),
}));

jest.mock('../job-lock', () => ({
  acquireDistributedJobLock: jest.fn().mockResolvedValue(true),
  releaseDistributedJobLock: jest.fn().mockResolvedValue(undefined),
  renewDistributedJobLock: jest.fn().mockResolvedValue(true),
}));

jest.mock('../sync-players', () => ({
  syncPlayers: (...args: unknown[]) => mockSyncPlayers(...args),
}));

import { runJob } from '../scheduler';

describe('scheduler retry integration', () => {
  afterEach(() => {
    jest.useRealTimers();
    mockSyncPlayers.mockReset();
  });

  it('retries a failed handler result through the scheduled job execution path', async () => {
    jest.useFakeTimers();
    mockSyncPlayers
      .mockResolvedValueOnce({ success: false, errors: ['temporary provider error'] })
      .mockResolvedValueOnce({ success: true, errors: [] });

    const runPromise = runJob('sync-players');
    await jest.advanceTimersByTimeAsync(5000);
    const result = await runPromise;

    expect(mockSyncPlayers).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('completed');
    expect(result.attemptCount).toBe(2);
    expect(result.retryCount).toBe(1);
    expect(result.isDeadLetter).toBe(false);
  });

  it('handles job timeout and releases lock once, without duplicate release on late settlement', async () => {
    jest.useFakeTimers();
    let resolveLate: (val: unknown) => void;
    mockSyncPlayers.mockImplementation(() => new Promise((resolve) => {
      resolveLate = resolve;
    }));

    const { releaseDistributedJobLock } = jest.requireMock('../job-lock');
    (releaseDistributedJobLock as jest.Mock).mockClear();

    const runPromise = runJob('sync-players');
    await jest.advanceTimersByTimeAsync(50_000);
    const result = await runPromise;

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Job exceeded timeout');
    expect(releaseDistributedJobLock).toHaveBeenCalledTimes(1);

    // Let the late handler settle
    resolveLate!({ success: true, errors: [] });
    await Promise.resolve();
    await Promise.resolve();

    // Verify lock release was not called a second time
    expect(releaseDistributedJobLock).toHaveBeenCalledTimes(1);
  });
});

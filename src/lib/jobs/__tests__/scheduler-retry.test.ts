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
});

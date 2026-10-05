/// <reference types="jest" />

import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import { acquireDistributedJobLock, releaseDistributedJobLock } from '../job-lock';

jest.mock('@/lib/db/supabase-server', () => ({
  getSupabaseServerClient: jest.fn(),
}));

describe('distributed job locks', () => {
  const rpc = jest.fn();

  beforeEach(() => {
    rpc.mockReset();
    (getSupabaseServerClient as jest.Mock).mockReturnValue({ rpc });
  });

  it('returns false when another execution owns the lock', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    await expect(acquireDistributedJobLock('sync-players', 'execution-1')).resolves.toBe(false);
    expect(rpc).toHaveBeenCalledWith('acquire_job_execution_lock', {
      p_job_name: 'sync-players',
      p_execution_id: 'execution-1',
      p_lease_seconds: 7200,
    });
  });

  it('fails closed when the database lock cannot be acquired', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'RPC unavailable' } });

    await expect(acquireDistributedJobLock('sync-players', 'execution-1'))
      .rejects.toThrow('Failed to acquire distributed lock');
  });

  it('releases only the lock owned by the execution', async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(releaseDistributedJobLock('sync-players', 'execution-1')).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('release_job_execution_lock', {
      p_job_name: 'sync-players',
      p_execution_id: 'execution-1',
    });
  });
});

import { runJobWithRetry } from '../job-runner';

describe('runJobWithRetry', () => {
  it('retries a thrown failure and returns the successful result', async () => {
    const job = jest.fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({ success: true, value: 'done' });

    const outcome = await runJobWithRetry('test-job', job, {
      maxAttempts: 3,
      baseDelayMs: 0,
    });

    expect(job).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({
      result: { success: true, value: 'done' },
      attempts: 2,
      retryCount: 1,
      isDeadLetter: false,
    });
  });

  it('retries a job result with success=false', async () => {
    const job = jest.fn()
      .mockResolvedValueOnce({ success: false, errors: ['temporary failure'] })
      .mockResolvedValueOnce({ success: true, errors: [] });

    const outcome = await runJobWithRetry('test-job', job, {
      maxAttempts: 3,
      baseDelayMs: 0,
    });

    expect(job).toHaveBeenCalledTimes(2);
    expect(outcome.error).toBeUndefined();
    expect(outcome.result).toEqual({ success: true, errors: [] });
    expect(outcome.retryCount).toBe(1);
    expect(outcome.isDeadLetter).toBe(false);
  });

  it('marks exhausted thrown and unsuccessful results as dead letters', async () => {
    const job = jest.fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValue({ success: false, errors: ['persistent failure'] });

    const outcome = await runJobWithRetry('test-job', job, {
      maxAttempts: 3,
      baseDelayMs: 0,
    });

    expect(job).toHaveBeenCalledTimes(3);
    expect(outcome).toMatchObject({
      attempts: 3,
      retryCount: 3,
      error: 'persistent failure',
      isDeadLetter: true,
    });
  });

  it('stops retrying when the scheduler time budget cannot accommodate another backoff', async () => {
    const job = jest.fn().mockRejectedValue(new Error('temporary failure'));

    const outcome = await runJobWithRetry('test-job', job, {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDurationMs: 1,
    });

    expect(job).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({
      attempts: 1,
      retryCount: 1,
      error: 'temporary failure',
      isDeadLetter: false,
    });
  });
});

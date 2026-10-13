import { getHandlerFailure } from './job-result';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 5000;

export interface JobRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDurationMs?: number;
}

export interface JobRetryOutcome<T> {
  result?: T;
  attempts: number;
  retryCount: number;
  error?: string;
  isDeadLetter: boolean;
}

function wait(delayMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return String(error);
}

/**
 * Runs a scheduled job with bounded exponential-backoff retries.
 * The scheduler owns execution logging, so every attempt is recorded in one
 * final execution row rather than creating competing rows per attempt.
 */
export async function runJobWithRetry<T>(
  jobName: string,
  jobFn: () => Promise<T>,
  options: JobRetryOptions = {}
): Promise<JobRetryOutcome<T>> {
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? BASE_DELAY_MS;
  const maxDurationMs = options.maxDurationMs ?? Number.POSITIVE_INFINITY;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('Job retry maxAttempts must be a positive integer');
  }
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
    throw new Error('Job retry baseDelayMs must be a non-negative finite number');
  }
  if (Number.isNaN(maxDurationMs) || maxDurationMs < 0) {
    throw new Error('Job retry maxDurationMs must be a non-negative number');
  }
  const startedAt = Date.now();
  let lastResult: T | undefined;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      lastResult = await jobFn();
      lastError = getHandlerFailure(lastResult) ?? undefined;
    } catch (error: unknown) {
      lastError = formatError(error);
    }

    if (!lastError) {
      return {
        result: lastResult,
        attempts: attempt,
        retryCount: attempt - 1,
        isDeadLetter: false,
      };
    }

    console.warn(`[JobRunner] ${jobName} failed (attempt ${attempt}/${maxAttempts}): ${lastError}`);
    if (attempt === maxAttempts) {
      console.error(`[JobRunner] ${jobName} moved to dead-letter after ${maxAttempts} attempts.`);
      return {
        result: lastResult,
        attempts: attempt,
        retryCount: attempt,
        error: lastError,
        isDeadLetter: true,
      };
    }

    const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
    if (Date.now() - startedAt + delayMs >= maxDurationMs) {
      return {
        result: lastResult,
        attempts: attempt,
        retryCount: attempt,
        error: lastError,
        isDeadLetter: false,
      };
    }

    await wait(delayMs);
  }

  throw new Error('Job retry loop exited without a result');
}

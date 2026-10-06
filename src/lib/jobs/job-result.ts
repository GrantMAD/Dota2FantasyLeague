export interface HandlerResult {
  success?: unknown;
  errors?: unknown;
  error?: unknown;
}

export function getHandlerFailure(result: unknown): string | null {
  if (typeof result !== 'object' || result === null) return null;

  const jobResult = result as HandlerResult;
  if (jobResult.success === false) {
    const details = Array.isArray(jobResult.errors)
      ? jobResult.errors.filter((error): error is string => typeof error === 'string')
      : [];
    return details.length > 0 ? details.join('; ') : 'Job reported success=false';
  }

  if (typeof jobResult.success !== 'boolean' && Array.isArray(jobResult.errors)) {
    const details = jobResult.errors.filter((error): error is string => typeof error === 'string');
    if (details.length > 0) return details.join('; ');
  }

  if (typeof jobResult.error === 'string' && jobResult.error.length > 0) {
    return jobResult.error;
  }

  return null;
}

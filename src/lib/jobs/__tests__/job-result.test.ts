import { getHandlerFailure } from '../job-result';

describe('getHandlerFailure', () => {
  it('does not classify successful job results as failed', () => {
    expect(getHandlerFailure({ success: true, errors: ['non-fatal warning'] })).toBeNull();
    expect(getHandlerFailure({ success: true })).toBeNull();
    expect(getHandlerFailure({
      success: true,
      discovered: 2,
      updated: 0,
      errors: ['Failed to fetch tournaments from opendota: The operation was aborted due to timeout'],
    })).toBeNull();
  });

  it('reports explicit failures and their diagnostic messages', () => {
    expect(getHandlerFailure({ success: false, errors: ['provider unavailable'] }))
      .toBe('provider unavailable');
    expect(getHandlerFailure({ success: false })).toBe('Job reported success=false');
  });

  it('treats errors as failure when a handler does not expose a success flag', () => {
    expect(getHandlerFailure({ errors: ['failed to update record'] }))
      .toBe('failed to update record');
  });

  it('ignores non-object and empty results', () => {
    expect(getHandlerFailure(undefined)).toBeNull();
    expect(getHandlerFailure(null)).toBeNull();
    expect(getHandlerFailure({ errors: [] })).toBeNull();
  });
});

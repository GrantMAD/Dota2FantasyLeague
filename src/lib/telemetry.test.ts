import {
  getReadSampleRate,
  getDetailSampleRate,
  getSlowRequestThreshold,
  createPageViewEvent,
  normalizeRoutePath,
  shouldRetainTelemetryDetail,
  shouldCaptureDatabaseEvent,
  summarizeTelemetryEvents,
} from './telemetry';

describe('telemetry helpers', () => {
  it('normalizes numeric and UUID path segments to keep route cardinality bounded', () => {
    expect(normalizeRoutePath('/api/users/812/teams/9f5c95c0-6027-4a22-8a33-7ce34b5fd934'))
      .toBe('/api/users/:id/teams/:id');
  });

  it('records only normalized, non-API page-view paths with valid correlation IDs', () => {
    const traceId = '9f5c95c0-6027-4a22-8a33-7ce34b5fd934';
    expect(createPageViewEvent('/dashboard/team/17', traceId)).toMatchObject({
      event_type: 'page_view',
      route: '/dashboard/team/:id',
      trace_id: traceId,
    });
    expect(createPageViewEvent('/api/private', traceId)).toBeNull();
    expect(createPageViewEvent('/reset-password?token=secret', traceId)).toBeNull();
    expect(createPageViewEvent('/dashboard', 'not-a-uuid')).toBeNull();
  });

  it('clamps read sampling configuration and always retains writes and failures', () => {
    expect(getReadSampleRate(undefined)).toBe(0.1);
    expect(getReadSampleRate('2')).toBe(1);
    expect(getReadSampleRate('-1')).toBe(0);
    expect(shouldCaptureDatabaseEvent('GET', 200, 0.1, 0.5)).toBe(false);
    expect(shouldCaptureDatabaseEvent('GET', 500, 0, 0.5)).toBe(true);
    expect(shouldCaptureDatabaseEvent('POST', 200, 0, 0.5)).toBe(true);
  });

  it('retains all errors and slow traces while sampling routine detail rows', () => {
    expect(getDetailSampleRate(undefined)).toBe(0.01);
    expect(getDetailSampleRate('2')).toBe(1);
    expect(getDetailSampleRate('-1')).toBe(0);
    expect(getSlowRequestThreshold(undefined)).toBe(2000);
    expect(getSlowRequestThreshold('0')).toBe(0);
    expect(getSlowRequestThreshold('-1')).toBe(2000);
    expect(getSlowRequestThreshold('700000')).toBe(600000);
    expect(shouldRetainTelemetryDetail({ event_type: 'api_request', status_code: 503 }, 0, 2000, 0.5)).toBe(true);
    expect(shouldRetainTelemetryDetail({ event_type: 'database_request', duration_ms: 2000 }, 0, 2000, 0.5)).toBe(true);
    expect(shouldRetainTelemetryDetail({ event_type: 'api_request', status_code: 200 }, 0.01, 2000, 0.005)).toBe(true);
    expect(shouldRetainTelemetryDetail({ event_type: 'api_request', status_code: 200 }, 0.01, 2000, 0.5)).toBe(false);
  });

  it('summarizes event categories, failures, average duration and p95', () => {
    expect(summarizeTelemetryEvents([
      { event_type: 'api_request', status_code: 200, duration_ms: 10, error_class: null },
      { event_type: 'database_request', status_code: 500, duration_ms: 20, error_class: null },
      { event_type: 'provider_request', status_code: 200, duration_ms: 100, error_class: null },
      { event_type: 'database_request', status_code: null, duration_ms: 40, error_class: 'TypeError' },
    ])).toEqual({
      sampleSize: 4,
      pageViews: 0,
      apiRequests: 1,
      databaseRequests: 2,
      providerRequests: 1,
      errors: 2,
      averageDurationMs: 43,
      p95DurationMs: 100,
    });
  });
});

const mockAfter = jest.fn((callback: () => void | Promise<void>) => {
  mockCallbacks.push(callback);
});
const mockCallbacks: Array<() => void | Promise<void>> = [];

jest.mock('next/server', () => ({
  after: (callback: () => void | Promise<void>) => mockAfter(callback),
}));

import { flushTelemetryEvents, runWithTelemetrySuppressed, runWithTraceId, scheduleTelemetryWrite } from './server-telemetry';

describe('server telemetry batching', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    mockCallbacks.length = 0;
    mockAfter.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  afterAll(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
  });

  it('persists all events for one trace in a single request', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
    try {
      await runWithTraceId('9f5c95c0-6027-4a22-8a33-7ce34b5fd934', async () => {
        scheduleTelemetryWrite({ event_type: 'database_request', method: 'GET', resource: 'players' });
        scheduleTelemetryWrite({ event_type: 'api_request', route: '/api/players', method: 'GET', status_code: 200 });
        flushTelemetryEvents();
      });

      expect(mockAfter).toHaveBeenCalledTimes(1);
      await mockCallbacks[0]();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const requestBody = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
      expect(requestBody).toHaveLength(2);
      expect(requestBody.map((event: { event_type: string }) => event.event_type)).toEqual([
        'database_request',
        'api_request',
      ]);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('does not collect events inside a telemetry-suppressed context', async () => {
    await runWithTraceId('9f5c95c0-6027-4a22-8a33-7ce34b5fd934', async () => {
      await runWithTelemetrySuppressed(() => {
        scheduleTelemetryWrite({ event_type: 'database_request', method: 'POST', resource: 'interaction_telemetry' });
      });
      flushTelemetryEvents();
    });

    expect(mockAfter).not.toHaveBeenCalled();
  });
});

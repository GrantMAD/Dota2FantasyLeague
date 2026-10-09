const mockGetCurrentTraceId = jest.fn();
const mockScheduleTelemetryWrite = jest.fn();
const mockFlushTelemetryEvents = jest.fn();
const mockRunWithTraceId = jest.fn((...args: [string, () => unknown, (string | null)?]) => args[1]());

jest.mock('@/lib/server-telemetry', () => ({
  getCurrentTraceId: (...args: unknown[]) => mockGetCurrentTraceId(...args),
  flushTelemetryEvents: (...args: unknown[]) => mockFlushTelemetryEvents(...args),
  runWithTelemetrySuppressed: (callback: () => unknown) => callback(),
  runWithTraceId: (...args: [string, () => unknown, (string | null)?]) => mockRunWithTraceId(...args),
  scheduleTelemetryWrite: (...args: unknown[]) => mockScheduleTelemetryWrite(...args),
}));

import { withApiTelemetry } from './api-telemetry';

describe('withApiTelemetry', () => {
  beforeEach(() => {
    mockGetCurrentTraceId.mockReset().mockResolvedValue(null);
    mockScheduleTelemetryWrite.mockReset();
    mockFlushTelemetryEvents.mockReset();
    mockRunWithTraceId.mockClear();
  });

  it('records normalized request metadata without recording request content', async () => {
    const handler = withApiTelemetry('POST', '/api/lineups/:id', async (request: Request) => {
      expect(request.method).toBe('POST');
      return Response.json({ saved: true });
    });
    const request = new Request('https://fantasy.example/api/lineups/12', {
      method: 'POST',
      headers: { 'x-request-id': '9f5c95c0-6027-4a22-8a33-7ce34b5fd934' },
      body: JSON.stringify({ password: 'must-not-be-recorded' }),
    });

    const response = await handler(request);

    expect(response.status).toBe(200);
    const [event] = mockScheduleTelemetryWrite.mock.calls[0];
    expect(event).toMatchObject({
      event_type: 'api_request',
      route: '/api/lineups/:id',
      method: 'POST',
      status_code: 200,
      trace_id: '9f5c95c0-6027-4a22-8a33-7ce34b5fd934',
    });
    expect(JSON.stringify(event)).not.toContain('must-not-be-recorded');
    expect(mockFlushTelemetryEvents).toHaveBeenCalledTimes(1);
    expect(mockRunWithTraceId).toHaveBeenCalledWith(
      '9f5c95c0-6027-4a22-8a33-7ce34b5fd934',
      expect.any(Function),
      '/api/lineups/:id',
    );
  });

  it('records thrown handler failures and preserves the original error', async () => {
    const failure = new Error('database unavailable');
    const handler = withApiTelemetry('GET', '/api/example', async () => { throw failure; });

    await expect(handler()).rejects.toBe(failure);
    expect(mockScheduleTelemetryWrite).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'api_request',
      status_code: 500,
      error_class: 'Error',
    }));
    expect(mockFlushTelemetryEvents).toHaveBeenCalledTimes(1);
  });
});

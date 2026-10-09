import { randomUUID } from 'node:crypto';
import { flushTelemetryEvents, getCurrentTraceId, runWithTelemetrySuppressed, runWithTraceId, scheduleTelemetryWrite } from '@/lib/server-telemetry';
import { getErrorClass, normalizeRoutePath } from '@/lib/telemetry';

type ApiHandler<Args extends unknown[]> = (...args: Args) => Response | Promise<Response>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function withApiTelemetry<Args extends unknown[]>(
  method: string,
  routeTemplate: string,
  handler: ApiHandler<Args>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args): Promise<Response> => {
    const request = args[0] instanceof Request ? args[0] : null;
    const startedAt = performance.now();
    const route = normalizeRoutePath(routeTemplate);
    const responseMethod = request?.method ?? method;
    const requestTraceId = request?.headers.get('x-request-id') ?? await getCurrentTraceId();
    const traceId = requestTraceId && UUID_PATTERN.test(requestTraceId) ? requestTraceId : randomUUID();
    const isTelemetryIngestion = route === '/api/telemetry/events';
    const isTelemetryRoute = isTelemetryIngestion || route === '/api/admin/telemetry';

    return runWithTraceId(traceId, async () => {
      try {
        const response = isTelemetryIngestion
          ? await runWithTelemetrySuppressed(() => handler(...args))
          : await handler(...args);
        if (!isTelemetryRoute) {
          scheduleTelemetryWrite({
            event_type: 'api_request',
            trace_id: traceId,
            route,
            method: responseMethod,
            status_code: response.status,
            duration_ms: Math.round(performance.now() - startedAt),
            deployment_id: process.env.VERCEL_DEPLOYMENT_ID ?? null,
            sample_rate: 1,
            metadata: {
              response_bytes: Number(response.headers.get('content-length')) || null,
            },
          });
          flushTelemetryEvents();
        }
        return response;
      } catch (error) {
        if (!isTelemetryRoute) {
          scheduleTelemetryWrite({
            event_type: 'api_request',
            trace_id: traceId,
            route,
            method: responseMethod,
            status_code: 500,
            duration_ms: Math.round(performance.now() - startedAt),
            error_class: getErrorClass(error),
            deployment_id: process.env.VERCEL_DEPLOYMENT_ID ?? null,
            sample_rate: 1,
          });
          flushTelemetryEvents();
        }
        throw error;
      }
    });
  };
}

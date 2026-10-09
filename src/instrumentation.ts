import { getErrorClass, getReadSampleRate, normalizeRoutePath, shouldCaptureDatabaseEvent } from '@/lib/telemetry';

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const originalFetch = globalThis.fetch.bind(globalThis);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : null;
  const stratzHost = process.env.STRATZ_API_URL ? new URL(process.env.STRATZ_API_URL).hostname : 'api.stratz.com';
  const sampleRate = getReadSampleRate(process.env.TELEMETRY_DB_READ_SAMPLE_RATE);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let target: URL;
    try {
      const source = input instanceof Request ? input.url : input.toString();
      target = new URL(source, process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost');
    } catch {
      return originalFetch(input, init);
    }

    const isDatabaseRequest = target.hostname === supabaseHost && (
      target.pathname.startsWith('/rest/v1/') ||
      target.pathname.startsWith('/auth/v1/') ||
      target.pathname.startsWith('/storage/v1/')
    );
    const isProviderRequest = target.hostname === 'api.opendota.com' || target.hostname === stratzHost;
    if (!isDatabaseRequest && !isProviderRequest) return originalFetch(input, init);
    if (isDatabaseRequest && (
      target.pathname.startsWith('/rest/v1/interaction_telemetry') ||
      target.pathname === '/rest/v1/rpc/record_interaction_telemetry'
    )) return originalFetch(input, init);

    const request = input instanceof Request ? input : null;
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    const startedAt = performance.now();
    const resource = isDatabaseRequest
      ? target.pathname.startsWith('/rest/v1/')
        ? target.pathname.split('/')[3] === 'rpc'
          ? `rpc_${target.pathname.split('/')[4] ?? 'unknown'}`
          : target.pathname.split('/')[3] ?? 'unknown'
        : target.pathname.split('/').filter(Boolean).slice(2, 3)[0] ?? 'unknown'
      : target.hostname === 'api.opendota.com' ? 'opendota' : 'stratz';
    const safeResource = resource.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 80) || 'unknown';
    const queryKeys = [...target.searchParams.keys()].sort().join(',');
    const fingerprint = `${method}:${safeResource}:${isProviderRequest ? normalizeRoutePath(target.pathname) : queryKeys}`.slice(0, 120);

    try {
      const response = await originalFetch(input, init);
      const { getCurrentRoute, isTelemetrySuppressed } = await import('@/lib/server-telemetry');
      if (isTelemetrySuppressed()) return response;
      if (isProviderRequest || shouldCaptureDatabaseEvent(method, response.status, sampleRate)) {
        const eventType = isDatabaseRequest ? 'database_request' : 'provider_request';
        const contentLength = Number(response.headers.get('content-length'));
        const { scheduleTelemetryWrite, getCurrentTraceId } = await import('@/lib/server-telemetry');
        scheduleTelemetryWrite({
          event_type: eventType,
          trace_id: await getCurrentTraceId(),
          route: getCurrentRoute(),
          method,
          resource: safeResource,
          status_code: response.status,
          duration_ms: Math.round(performance.now() - startedAt),
          deployment_id: process.env.VERCEL_DEPLOYMENT_ID ?? null,
          sample_rate: isDatabaseRequest && ['GET', 'HEAD'].includes(method) && response.status < 400 ? sampleRate : 1,
          metadata: {
            query_fingerprint: fingerprint,
            response_bytes: Number.isFinite(contentLength) && contentLength >= 0 ? contentLength : null,
          },
        });
      }
      return response;
    } catch (error) {
      const { getCurrentRoute, isTelemetrySuppressed } = await import('@/lib/server-telemetry');
      if (isTelemetrySuppressed()) throw error;
      const { scheduleTelemetryWrite, getCurrentTraceId } = await import('@/lib/server-telemetry');
      scheduleTelemetryWrite({
        event_type: isDatabaseRequest ? 'database_request' : 'provider_request',
        trace_id: await getCurrentTraceId(),
        route: getCurrentRoute(),
        method,
        resource: safeResource,
        duration_ms: Math.round(performance.now() - startedAt),
        error_class: getErrorClass(error),
        deployment_id: process.env.VERCEL_DEPLOYMENT_ID ?? null,
        sample_rate: 1,
        metadata: { query_fingerprint: fingerprint },
      });
      throw error;
    }
  };
}

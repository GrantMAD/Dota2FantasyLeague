import { NextResponse } from 'next/server';
import { createErrorResponse, verifyAdminAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { normalizeRoutePath, summarizeTelemetryEvents, type TelemetryEventType } from '@/lib/telemetry';
import { withApiTelemetry } from '@/lib/api-telemetry';


const EVENT_TYPES: TelemetryEventType[] = [
  'page_view',
  'api_request',
  'database_request',
  'provider_request',
];
const PAGE_SIZE_MAX = 100;
const SUMMARY_SAMPLE_MAX = 1000;

async function getHandler(request: Request) {
  try {
    await verifyAdminAuth(request);
    const params = new URL(request.url).searchParams;
    const requestedHours = Number.parseInt(params.get('hours') ?? '24', 10);
    const hours = Number.isFinite(requestedHours) ? Math.min(4320, Math.max(1, requestedHours)) : 24;
    const requestedLimit = Number.parseInt(params.get('limit') ?? '50', 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(PAGE_SIZE_MAX, Math.max(1, requestedLimit)) : 50;
    const requestedPage = Number.parseInt(params.get('page') ?? '1', 10);
    const page = Number.isFinite(requestedPage) ? Math.min(200, Math.max(1, requestedPage)) : 1;
    const selectedType = params.get('event_type');
    if (selectedType && !EVENT_TYPES.includes(selectedType as TelemetryEventType)) {
      return NextResponse.json({ error: 'Unsupported telemetry event type.' }, { status: 400 });
    }
    const eventType = selectedType as TelemetryEventType | null;
    const route = params.get('route');
    const traceId = params.get('trace_id');
    if (route && (!route.startsWith('/') || route.startsWith('//') || /[?#\\\u0000-\u001f]/.test(route))) {
      return NextResponse.json({ error: 'Route filter must be a normalized path without query parameters.' }, { status: 400 });
    }
    if (traceId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(traceId)) {
      return NextResponse.json({ error: 'Trace ID must be a UUID.' }, { status: 400 });
    }
    const routeFilter = route ? normalizeRoutePath(route) : null;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const supabase = supabaseServer();
    const columns = 'id, recorded_at, event_type, trace_id, route, method, resource, status_code, duration_ms, error_class, deployment_id, sample_rate, metadata';

    // The telemetry table is provisioned by the accompanying SQL migration.
    const buildQuery = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = (supabase.from('interaction_telemetry') as any)
        .select(columns)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: false });
      if (eventType) query = query.eq('event_type', eventType);
      if (routeFilter) query = query.eq('route', routeFilter);
      if (traceId) query = query.eq('trace_id', traceId);
      return query;
    };

    const eventsPromise = buildQuery().range((page - 1) * limit, page * limit - 1);
    const summaryPromise = traceId
      ? buildQuery().limit(SUMMARY_SAMPLE_MAX)
      : // The aggregate RPC reads compact minute buckets instead of scanning individual detail events.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.rpc as any)('get_interaction_telemetry_summary', {
          p_since: since,
          p_event_type: eventType,
          p_route: routeFilter,
        });
    const [eventsResult, summaryResult] = await Promise.all([eventsPromise, summaryPromise]);
    if (eventsResult.error || summaryResult.error) {
      console.error('[Telemetry] Failed to query telemetry data:', eventsResult.error ?? summaryResult.error);
      return NextResponse.json({ error: 'Failed to load telemetry data.' }, { status: 500 });
    }

    const summaryEvents = traceId ? summaryResult.data ?? [] : null;
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      windowHours: hours,
      summarySampleCapped: Boolean(traceId && summaryEvents && summaryEvents.length >= SUMMARY_SAMPLE_MAX),
      summary: traceId
        ? summarizeTelemetryEvents(summaryEvents ?? [])
        : summaryResult.data,
      summaryIsEstimated: !traceId,
      events: eventsResult.data ?? [],
      page,
      pageSize: limit,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}

export const GET = withApiTelemetry('GET', '/api/admin/telemetry', getHandler);

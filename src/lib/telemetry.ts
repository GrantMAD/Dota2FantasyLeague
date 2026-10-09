export type TelemetryEventType =
  | 'page_view'
  | 'api_request'
  | 'database_request'
  | 'provider_request';

export interface TelemetryEvent {
  event_type: TelemetryEventType;
  trace_id?: string | null;
  route?: string | null;
  method?: string | null;
  resource?: string | null;
  status_code?: number | null;
  duration_ms?: number | null;
  error_class?: string | null;
  deployment_id?: string | null;
  sample_rate?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface TelemetrySummary {
  sampleSize: number;
  pageViews: number;
  apiRequests: number;
  databaseRequests: number;
  providerRequests: number;
  errors: number;
  averageDurationMs: number;
  p95DurationMs: number;
}

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INTEGER_SEGMENT = /^\d+$/;

export function normalizeRoutePath(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => {
      if (UUID_SEGMENT.test(segment) || INTEGER_SEGMENT.test(segment)) return ':id';
      return segment.slice(0, 80);
    })
    .join('/')
    .slice(0, 240);
}

export function getReadSampleRate(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 0.1;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.1;
  return Math.min(1, Math.max(0, parsed));
}

export function shouldCaptureDatabaseEvent(
  method: string,
  status: number,
  sampleRate: number,
  randomValue = Math.random(),
): boolean {
  const isRead = ['GET', 'HEAD'].includes(method.toUpperCase());
  return status >= 400 || !isRead || randomValue < sampleRate;
}

export function getErrorClass(error: unknown): string {
  if (error instanceof Error && error.name) return error.name.slice(0, 80);
  return 'RequestError';
}

export function summarizeTelemetryEvents(
  events: Array<Pick<TelemetryEvent, 'event_type' | 'status_code' | 'duration_ms' | 'error_class'>>,
): TelemetrySummary {
  const durations = events
    .map((event) => event.duration_ms)
    .filter((duration): duration is number => typeof duration === 'number' && Number.isFinite(duration) && duration >= 0)
    .sort((left, right) => left - right);
  const durationTotal = durations.reduce((total, duration) => total + duration, 0);
  const p95Index = durations.length ? Math.ceil(durations.length * 0.95) - 1 : -1;

  return {
    sampleSize: events.length,
    pageViews: events.filter((event) => event.event_type === 'page_view').length,
    apiRequests: events.filter((event) => event.event_type === 'api_request').length,
    databaseRequests: events.filter((event) => event.event_type === 'database_request').length,
    providerRequests: events.filter((event) => event.event_type === 'provider_request').length,
    errors: events.filter((event) => (event.status_code ?? 0) >= 400 || Boolean(event.error_class)).length,
    averageDurationMs: durations.length ? Math.round(durationTotal / durations.length) : 0,
    p95DurationMs: p95Index >= 0 ? durations[p95Index] : 0,
  };
}

export function createPageViewEvent(pathname: string, traceId: string): TelemetryEvent | null {
  if (
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    pathname === '/api' ||
    pathname.startsWith('/api/') ||
    /[?#\\\u0000-\u001f]/.test(pathname)
  ) return null;
  if (!UUID_SEGMENT.test(traceId)) return null;
  return {
    event_type: 'page_view',
    trace_id: traceId,
    route: normalizeRoutePath(pathname),
    sample_rate: 1,
    metadata: { source: 'browser' },
  };
}

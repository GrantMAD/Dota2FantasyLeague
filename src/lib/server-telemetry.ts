import { AsyncLocalStorage } from 'node:async_hooks';
import { after } from 'next/server';
import { headers } from 'next/headers';
import {
  getDetailSampleRate,
  getSlowRequestThreshold,
  shouldRetainTelemetryDetail,
  type TelemetryEvent,
} from '@/lib/telemetry';

const TELEMETRY_RPC = 'record_interaction_telemetry';
const MAX_EVENTS_PER_TRACE = 250;
interface TraceContext {
  traceId: string;
  route: string | null;
  suppressed: boolean;
  events: TelemetryEvent[];
}
const traceContext = new AsyncLocalStorage<TraceContext>();

export function runWithTraceId<T>(traceId: string, callback: () => T, route: string | null = null): T {
  return traceContext.run({ traceId, route, suppressed: false, events: [] }, callback);
}

export function runWithTelemetrySuppressed<T>(callback: () => T): T {
  const current = traceContext.getStore();
  return traceContext.run({
    traceId: current?.traceId ?? '',
    route: current?.route ?? null,
    suppressed: true,
    events: current?.events ?? [],
  }, callback);
}

export function isTelemetrySuppressed(): boolean {
  return traceContext.getStore()?.suppressed ?? false;
}

export function getCurrentRoute(): string | null {
  return traceContext.getStore()?.route ?? null;
}

export function scheduleTelemetryWrite(event: TelemetryEvent): void {
  const context = traceContext.getStore();
  if (context?.suppressed) return;
  if (context) {
    if (context.events.length < MAX_EVENTS_PER_TRACE) {
      context.events.push(event);
    } else if (context.events.length === MAX_EVENTS_PER_TRACE) {
      console.warn('[Telemetry] Per-request event cap reached; additional events were dropped.');
    }
    return;
  }
  persistTelemetryEvents([event]);
}

export function flushTelemetryEvents(): void {
  const context = traceContext.getStore();
  if (!context || context.suppressed || context.events.length === 0) return;
  const events = context.events.splice(0, MAX_EVENTS_PER_TRACE);
  persistTelemetryEvents(events);
}

function persistTelemetryEvents(events: TelemetryEvent[]): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.warn('[Telemetry] Supabase telemetry storage is not configured.');
    return;
  }

  try {
    after(async () => {
      try {
        const detailSampleRate = getDetailSampleRate(process.env.TELEMETRY_DETAIL_SAMPLE_RATE);
        const slowRequestThreshold = getSlowRequestThreshold(process.env.TELEMETRY_SLOW_REQUEST_THRESHOLD_MS);
        const details = events.filter((event) => shouldRetainTelemetryDetail(
          event,
          detailSampleRate,
          slowRequestThreshold,
        ));
        const response = await runWithTelemetrySuppressed(() => fetch(`${url}/rest/v1/rpc/${TELEMETRY_RPC}`, {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ event_batch: events, detail_batch: details }),
          cache: 'no-store',
        }));

        if (!response.ok) {
          console.warn(`[Telemetry] Storage rejected ${events.length} aggregate events with status ${response.status}.`);
        }
      } catch (error) {
        console.warn(`[Telemetry] Persistence failed for ${events.length} aggregate events:`, error);
      }
    });
  } catch (error) {
    console.warn('[Telemetry] Could not schedule event persistence:', error);
  }
}

export async function getCurrentTraceId(): Promise<string | null> {
  const activeTrace = traceContext.getStore();
  if (activeTrace?.traceId) return activeTrace.traceId;
  try {
    const requestTraceId = (await headers()).get('x-request-id');
    return requestTraceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestTraceId)
      ? requestTraceId
      : null;
  } catch {
    return null;
  }
}

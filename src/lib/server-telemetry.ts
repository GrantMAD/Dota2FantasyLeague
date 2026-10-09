import { AsyncLocalStorage } from 'node:async_hooks';
import { after } from 'next/server';
import { headers } from 'next/headers';
import type { TelemetryEvent } from '@/lib/telemetry';

const TELEMETRY_TABLE = 'interaction_telemetry';
const MAX_EVENTS_PER_TRACE = 250;
interface TraceContext {
  traceId: string;
  suppressed: boolean;
  events: TelemetryEvent[];
}
const traceContext = new AsyncLocalStorage<TraceContext>();

export function runWithTraceId<T>(traceId: string, callback: () => T): T {
  return traceContext.run({ traceId, suppressed: false, events: [] }, callback);
}

export function runWithTelemetrySuppressed<T>(callback: () => T): T {
  const current = traceContext.getStore();
  return traceContext.run({
    traceId: current?.traceId ?? '',
    suppressed: true,
    events: current?.events ?? [],
  }, callback);
}

export function isTelemetrySuppressed(): boolean {
  return traceContext.getStore()?.suppressed ?? false;
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
        const response = await fetch(`${url}/rest/v1/${TELEMETRY_TABLE}`, {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(events),
          cache: 'no-store',
        });

        if (!response.ok) {
          console.warn(`[Telemetry] Storage rejected ${events.length} events with status ${response.status}.`);
        }
      } catch (error) {
        console.warn(`[Telemetry] Persistence failed for ${events.length} events:`, error);
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

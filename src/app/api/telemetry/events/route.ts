import { NextResponse } from 'next/server';
import { createErrorResponse, verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';
import {
  createPageViewEvent,
  getDetailSampleRate,
  getSlowRequestThreshold,
  shouldRetainTelemetryDetail,
} from '@/lib/telemetry';

async function postHandler(request: Request) {
  try {
    await verifyAuth(request);
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 2048) {
      return NextResponse.json({ error: 'Telemetry event is too large.' }, { status: 413 });
    }

    let body: unknown;
    try {
      const reader = request.body?.getReader();
      if (!reader) return NextResponse.json({ error: 'Invalid telemetry event.' }, { status: 400 });
      const decoder = new TextDecoder();
      let text = '';
      let byteLength = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        byteLength += chunk.value.byteLength;
        if (byteLength > 2048) {
          await reader.cancel();
          return NextResponse.json({ error: 'Telemetry event is too large.' }, { status: 413 });
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Invalid telemetry event.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid telemetry event.' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const event = typeof input.route === 'string' && typeof input.trace_id === 'string'
      ? createPageViewEvent(input.route, input.trace_id)
      : null;
    if (!event) return NextResponse.json({ error: 'Invalid telemetry event.' }, { status: 400 });

    const supabase = supabaseServer();
    const retainDetail = shouldRetainTelemetryDetail(
      event,
      getDetailSampleRate(process.env.TELEMETRY_DETAIL_SAMPLE_RATE),
      getSlowRequestThreshold(process.env.TELEMETRY_SLOW_REQUEST_THRESHOLD_MS),
    );
    // The telemetry RPC and tables are provisioned by the accompanying SQL migration.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)('record_interaction_telemetry', {
      event_batch: [event],
      detail_batch: retainDetail ? [event] : [],
    });
    if (error) {
      console.error('[Telemetry] Failed to persist page view:', error.message);
      return NextResponse.json({ error: 'Unable to record telemetry event.' }, { status: 503 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}

export const POST = withApiTelemetry('POST', '/api/telemetry/events', postHandler);

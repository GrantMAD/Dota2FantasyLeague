import { NextRequest, NextResponse } from 'next/server';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

/**
 * POST /api/webhooks/match-result
 * Accepts a push notification from an external data provider when a match concludes.
 * This allows us to immediately trigger data fetching instead of waiting for the next poll cycle.
 *
 * Expected headers: x-webhook-secret: <secret>
 * Expected body: { matchId: number, status: string, providerId?: string }
 */
export async function POST(request: NextRequest) {
  // 1. Validate webhook secret
  const providedSecret = request.headers.get('x-webhook-secret');

  if (!WEBHOOK_SECRET || providedSecret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { matchId, status, providerId } = body;

    if (!matchId) {
      return NextResponse.json({ error: 'Missing required field: matchId' }, { status: 400 });
    }

    // 2. Trigger the cron job endpoint asynchronously to process this match immediately
    // We fire-and-forget — the webhook response should be fast.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET;

    fetch(`${baseUrl}/api/cron`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
      },
      body: JSON.stringify({
        job: 'fetch-match-details',
        trigger: 'webhook',
        matchId,
        providerId,
      }),
    }).catch((err) => {
      console.error('[Webhook] Failed to trigger downstream job:', err);
    });

    console.log(`[Webhook] match-result received: matchId=${matchId}, status=${status}`);

    return NextResponse.json({ received: true, matchId });
  } catch (error: any) {
    console.error('[Webhook] Error processing match-result payload:', error);
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
}

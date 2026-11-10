import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';
import { enforceAuthRateLimit } from '@/lib/auth-rate-limit';
import { getEmailConfirmationRedirectUrl } from '@/lib/auth-redirect';

async function postHandler(request: NextRequest) {
  try {
    const rateLimitResponse = await enforceAuthRateLimit(request, 'signup');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) {
      return NextResponse.json({ error: 'Email address is required.' }, { status: 400 });
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: getEmailConfirmationRedirectUrl(request.url),
      },
    });

    if (error) {
      console.error('Failed to resend account confirmation email.', { error: error.message });
      return NextResponse.json(
        { error: 'Unable to send a confirmation email right now. Please try again later.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      message: 'If an account needs confirmation, a new email will be sent shortly.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Confirmation email resend failed.', { error: message });
    return NextResponse.json(
      { error: 'Unable to send a confirmation email right now. Please try again later.' },
      { status: 500 },
    );
  }
}

export const POST = withApiTelemetry('POST', '/api/auth/resend-confirmation', postHandler);

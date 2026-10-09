import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';


async function getHandler(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const { data, error } = await supabaseServer().from('users')
      .select('theme_preference')
      .eq('id', userId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'Unable to load theme preference.' }, { status: 500 });
    return NextResponse.json({ theme: data?.theme_preference === 'light' ? 'light' : 'dark' });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 401;
    if (status === 401) return NextResponse.json({ theme: 'dark' });
    return NextResponse.json({ error: 'Unable to load theme preference.' }, { status });
  }
}

async function putHandler(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const body = await request.json();
    if (body.theme !== 'light' && body.theme !== 'dark') {
      return NextResponse.json({ error: 'Theme must be light or dark.' }, { status: 400 });
    }
    const { error } = await supabaseServer().from('users')
      .update({ theme_preference: body.theme, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) return NextResponse.json({ error: 'Unable to save theme preference.' }, { status: 500 });
    return NextResponse.json({ theme: body.theme });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: 'Unable to save theme preference.' }, { status });
  }
}

export const GET = withApiTelemetry('GET', '/api/user/theme', getHandler);
export const PUT = withApiTelemetry('PUT', '/api/user/theme', putHandler);

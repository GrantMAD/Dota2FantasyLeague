import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const { data, error } = await (supabaseServer().from('users') as any)
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

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const body = await request.json();
    if (body.theme !== 'light' && body.theme !== 'dark') {
      return NextResponse.json({ error: 'Theme must be light or dark.' }, { status: 400 });
    }
    const { error } = await (supabaseServer().from('users') as any)
      .update({ theme_preference: body.theme, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) return NextResponse.json({ error: 'Unable to save theme preference.' }, { status: 500 });
    return NextResponse.json({ theme: body.theme });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: 'Unable to save theme preference.' }, { status });
  }
}

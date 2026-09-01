import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    await verifyAuth(request);

    const body = await request.json();
    const { version, seasonId = 1, gameweekId } = body;

    if (!version || !gameweekId) {
      return NextResponse.json({ error: 'Missing version or effective gameweek ID' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Publish all rules for this version
    const { error: updateError } = await supabase
      .from('scoring_rules')
      .update({
        is_published: true,
        published_at: new Date().toISOString(),
        effective_from_gameweek_id: parseInt(gameweekId, 10)
      })
      .eq('season_id', parseInt(seasonId, 10))
      .eq('version', parseInt(version, 10))
      .eq('is_published', false);

    if (updateError) throw updateError;

    return NextResponse.json({ message: 'Scoring rules version published successfully' });
  } catch (error: any) {
    console.error('Error publishing scoring rules:', error);
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { calculateFixtureDifficulty, type CompletedTeamMatch } from '@/lib/fixture-difficulty';
import { withApiTelemetry } from '@/lib/api-telemetry';

const MAX_TEAM_IDS = 20;
const HISTORY_LOOKUP_LIMIT = 50;

function parseTeamIds(value: string | null): number[] | null {
  if (value === null || value.length === 0) return null;
  const parts = value.split(',');
  if (parts.length > MAX_TEAM_IDS) return null;
  const ids: number[] = [];
  for (const part of parts) {
    if (!/^[1-9]\d*$/.test(part)) return null;
    const parsed = Number(part);
    if (!Number.isSafeInteger(parsed)) return null;
    ids.push(parsed);
  }
  if (new Set(ids).size !== ids.length) return null;
  return ids;
}

function isAuthError(error: unknown): error is { status: number; message: string } {
  return typeof error === 'object' && error !== null
    && 'status' in error && typeof error.status === 'number'
    && 'message' in error && typeof error.message === 'string';
}

async function getHandler(request: NextRequest) {
  try {
    await verifyAuth(request);
    const teamIds = parseTeamIds(request.nextUrl.searchParams.get('teamIds'));
    if (!teamIds) {
      return NextResponse.json(
        { error: `Provide between 1 and ${MAX_TEAM_IDS} unique positive team IDs.` },
        { status: 400 },
      );
    }

    const supabase = supabaseServer();
    const ratings = await Promise.all(teamIds.map(async (teamId) => {
      const { data, error } = await supabase.from('matches')
        .select('team_a_id, team_b_id, winner_team_id, scheduled_time')
        .eq('status', 'completed')
        .not('winner_team_id', 'is', null)
        .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
        .lte('scheduled_time', new Date().toISOString())
        .order('scheduled_time', { ascending: false })
        .limit(HISTORY_LOOKUP_LIMIT);

      if (error) {
        console.error(`[Fixture Difficulty API] Fetch history for team ${teamId} failed:`, error);
        throw new Error('Failed to load recent opponent results.');
      }

      return [
        teamId,
        calculateFixtureDifficulty(teamId, (data ?? []) as CompletedTeamMatch[]),
      ] as const;
    }));

    return NextResponse.json({ ratingsByTeam: Object.fromEntries(ratings) });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[Fixture Difficulty API] Unexpected error:', error);
    return NextResponse.json({ error: 'Unable to load fixture difficulty.' }, { status: 500 });
  }
}

export const GET = withApiTelemetry('GET', '/api/fantasy/fixture-difficulty', getHandler);

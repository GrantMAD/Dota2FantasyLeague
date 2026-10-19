import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, applyRefreshedTokens, AuthError } from '@/lib/auth-utils';
import { getOrCreateFantasySeason } from '@/lib/fantasy-season';
import { withApiTelemetry } from '@/lib/api-telemetry';

interface UpdateGoalsBody {
  targetPoints?: number | null;
  targetRank?: number | null;
}

async function getGoalsHandler(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const supabase = supabaseServer();

    const fantasySeason = await getOrCreateFantasySeason(supabase, user.userId);
    if (!fantasySeason || !fantasySeason.id) {
      const emptyResponse = NextResponse.json({
        targetPoints: null,
        targetRank: null,
        totalPoints: 0,
        globalRank: null,
      });
      applyRefreshedTokens(emptyResponse, user);
      return emptyResponse;
    }

    const response = NextResponse.json({
      targetPoints: fantasySeason.target_points ?? null,
      targetRank: fantasySeason.target_rank ?? null,
      totalPoints: fantasySeason.total_points ?? 0,
      globalRank: fantasySeason.global_rank ?? null,
    });
    applyRefreshedTokens(response, user);
    return response;
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'Failed to retrieve season goals.' }, { status: 500 });
  }
}

async function putGoalsHandler(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const supabase = supabaseServer();

    let body: UpdateGoalsBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { targetPoints, targetRank } = body;

    // Validate targetPoints
    if (targetPoints !== undefined && targetPoints !== null) {
      if (typeof targetPoints !== 'number' || isNaN(targetPoints) || targetPoints <= 0 || targetPoints > 100000) {
        return NextResponse.json(
          { error: 'Target points must be a positive number up to 100,000.' },
          { status: 400 }
        );
      }
    }

    // Validate targetRank
    if (targetRank !== undefined && targetRank !== null) {
      if (typeof targetRank !== 'number' || !Number.isInteger(targetRank) || targetRank < 1 || targetRank > 10000000) {
        return NextResponse.json(
          { error: 'Target rank must be a positive integer of 1 or greater.' },
          { status: 400 }
        );
      }
    }

    const fantasySeason = await getOrCreateFantasySeason(supabase, user.userId);
    if (!fantasySeason || !fantasySeason.id) {
      return NextResponse.json({ error: 'Active fantasy season enrollment not found.' }, { status: 404 });
    }

    const updates: Record<string, number | null> = {};
    if (targetPoints !== undefined) {
      updates.target_points = targetPoints === null ? null : Math.round(targetPoints * 100) / 100;
    }
    if (targetRank !== undefined) {
      updates.target_rank = targetRank === null ? null : targetRank;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error: updateError } = await (supabase.from('fantasy_seasons') as any)
      .update(updates)
      .eq('id', fantasySeason.id)
      .select('id, target_points, target_rank, total_points, global_rank')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update goals: ${updateError.message}` },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      targetPoints: updated?.target_points !== null && updated?.target_points !== undefined ? Number(updated.target_points) : null,
      targetRank: updated?.target_rank !== null && updated?.target_rank !== undefined ? Number(updated.target_rank) : null,
      totalPoints: updated?.total_points !== null && updated?.total_points !== undefined ? Number(updated.total_points) : 0,
      globalRank: updated?.global_rank !== null && updated?.global_rank !== undefined ? Number(updated.global_rank) : null,
    });
    applyRefreshedTokens(response, user);
    return response;
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'Failed to update season goals.' }, { status: 500 });
  }
}

export const GET = withApiTelemetry('GET', '/api/user/goals', getGoalsHandler);
export const PUT = withApiTelemetry('PUT', '/api/user/goals', putGoalsHandler);

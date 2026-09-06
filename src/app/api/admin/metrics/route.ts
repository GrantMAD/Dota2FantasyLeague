import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAdminAuth, createErrorResponse } from '@/lib/auth-utils';

/**
 * GET /api/admin/metrics
 * Returns real platform KPI counts directly from database tables.
 */
export async function GET(request: NextRequest) {
  try {
    await verifyAdminAuth(request);
    const supabase = supabaseServer();

    // Query live table counts and active season in parallel
    const [
      usersResult,
      teamsResult,
      leaguesResult,
      activeSeasonResult,
      lastJobResult,
      conflictsResult,
      failedJobsResult,
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('fantasy_teams').select('*', { count: 'exact', head: true }),
      supabase.from('leagues').select('*', { count: 'exact', head: true }),
      supabase.from('seasons').select('name, status').eq('status', 'active').maybeSingle(),
      (supabase.from('job_execution_log') as any)
        .select('started_at')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      (supabase.from('data_conflicts') as any)
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unresolved'),
      (supabase.from('job_execution_log') as any)
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed'),
    ]);

    const activeUsers = usersResult.count ?? 0;
    const totalFantasyTeams = teamsResult.count ?? 0;
    const activeLeagues = leaguesResult.count ?? 0;
    const currentSeason = activeSeasonResult.data?.name ?? 'No Active Season';
    const lastSyncTime = lastJobResult.data?.started_at
      ? new Date(lastJobResult.data.started_at).toLocaleString()
      : 'Never';
    const dataConflicts = conflictsResult.count ?? 0;
    const failedJobs = failedJobsResult.count ?? 0;

    return NextResponse.json({
      success: true,
      metrics: {
        activeUsers,
        totalFantasyTeams,
        activeLeagues,
        currentSeason,
        lastSyncTime,
        dataConflicts,
        lowQualityRecords: 0,
        failedJobs,
      },
    });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}

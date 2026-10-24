import { NextRequest, NextResponse } from 'next/server';
import { getJobs, getAllJobStatuses } from '@/lib/jobs/scheduler';
import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import { getNextCronDate } from '@/lib/jobs/cron-utils';
import { withApiTelemetry } from '@/lib/api-telemetry';
import { getCached, setCached } from '@/lib/response-cache';

// Mapping each page key to relevant jobs in priority order
const PAGE_JOB_MAPPING: Record<string, string[]> = {
  matches: ['fetch-match-details', 'fetch-matches', 'process-completed-matches'],
  players: ['update-player-prices', 'sync-players', 'track-roster-changes'],
  transfers: ['update-player-prices', 'transition-gameweeks'],
  leaderboard: ['calculate-fantasy-scores', 'recalculate-gameweeks', 'calculate-global-rankings'],
  leagues: ['recalculate-leagues', 'calculate-fantasy-scores'],
  gameweeks: ['transition-gameweeks', 'recalculate-gameweeks', 'calculate-fantasy-scores'],
  dashboard: ['calculate-fantasy-scores', 'fetch-matches', 'transition-gameweeks'],
  tournaments: ['discover-tournaments'],
};

const JOB_DESCRIPTIONS: Record<string, { title: string; desc: string }> = {
  'fetch-match-details': {
    title: 'Live Match Details',
    desc: 'Ingests real-time player fantasy points & in-game stats',
  },
  'fetch-matches': {
    title: 'Match Schedule & Series',
    desc: 'Discovers new matches, series status & winner updates',
  },
  'process-completed-matches': {
    title: 'Match Settlement',
    desc: 'Locks completed match data for official fantasy calculation',
  },
  'calculate-fantasy-scores': {
    title: 'Fantasy Scoring Engine',
    desc: 'Calculates team scores and active gameweek points',
  },
  'recalculate-gameweeks': {
    title: 'Gameweek Standings',
    desc: 'Aggregates weekly scores into standings and leaderboards',
  },
  'recalculate-leagues': {
    title: 'Private & Public Leagues',
    desc: 'Updates rankings across all player leagues',
  },
  'calculate-global-rankings': {
    title: 'Global Leaderboards',
    desc: 'Calculates worldwide rank and tier placements',
  },
  'update-player-prices': {
    title: 'Player Valuations',
    desc: 'Updates transfer market prices based on player form',
  },
  'sync-players': {
    title: 'Player Database',
    desc: 'Syncs pro player profiles, teams & roles from OpenDota & Stratz',
  },
  'sync-teams': {
    title: 'Team Database',
    desc: 'Refreshes pro team ratings, rosters and logos',
  },
  'track-roster-changes': {
    title: 'Roster Updates',
    desc: 'Monitors pro player transfers and team substitutions',
  },
  'transition-gameweeks': {
    title: 'Gameweek Deadlines',
    desc: 'Locks lineups at deadline and transitions gameweeks',
  },
  'discover-tournaments': {
    title: 'Tournament Discovery',
    desc: 'Finds newly announced Tier 1 & Tier 2 tournaments',
  },
};

interface JobExecutionLog {
  job_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface JobDetailItem {
  jobName: string;
  title: string;
  description: string;
  schedule: string;
  status: string;
  lastRun: string | null;
  nextRun: string | null;
}

interface FreshnessResponse {
  success: boolean;
  page: string;
  lastUpdated: string | null;
  nextUpdate: string | null;
  jobName: string;
  serverTime: string;
  jobs: JobDetailItem[];
}

async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || 'matches';
    const cacheKey = `freshness:${page}`;
    const cached = getCached<FreshnessResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
      });
    }

    const targetJobNames = PAGE_JOB_MAPPING[page] || PAGE_JOB_MAPPING.matches;

    const allJobs = getJobs();
    const targetJobDefs = allJobs.filter((j) => targetJobNames.includes(j.name));
    const memoryStatuses = getAllJobStatuses();

    // Query recent logs for target jobs
    let dbLogs: JobExecutionLog[] = [];
    try {
      const supabase = getSupabaseServerClient();
      const { data } = await supabase
        .from('job_execution_log')
        .select('job_name, status, started_at, completed_at')
        .in('job_name', targetJobNames)
        .order('started_at', { ascending: false })
        .limit(30);
      dbLogs = data || [];
    } catch (err) {
      console.warn('[Data Freshness] Could not fetch job_execution_log:', err);
    }

    const now = new Date();

    let latestUpdatedDate: Date | null = null;
    let nextScheduledRun: Date | null = null;
    let mostFrequentJobName: string = targetJobNames[0];

    const jobsDetailList: JobDetailItem[] = [];

    for (const jobDef of targetJobDefs) {
      const inMem = memoryStatuses.find((s) => s.jobName === jobDef.name);
      const dbRun = dbLogs.find((l) => l.job_name === jobDef.name);

      const completedAtStr = inMem?.completedAt?.toISOString() || dbRun?.completed_at || dbRun?.started_at;
      let jobLastRun: string | null = null;
      if (completedAtStr) {
        const completedDate = new Date(completedAtStr);
        jobLastRun = completedDate.toISOString();
        if (!latestUpdatedDate || completedDate.getTime() > latestUpdatedDate.getTime()) {
          latestUpdatedDate = completedDate;
        }
      }

      let jobNextRun: string | null = null;
      try {
        const nextDate = getNextCronDate(jobDef.schedule, now);
        jobNextRun = nextDate.toISOString();
        if (!nextScheduledRun || nextDate.getTime() < nextScheduledRun.getTime()) {
          nextScheduledRun = nextDate;
          mostFrequentJobName = jobDef.name;
        }
      } catch {
        // Fallback or ignore cron parse error
      }

      const meta = JOB_DESCRIPTIONS[jobDef.name] || {
        title: jobDef.name,
        desc: 'Automated background task',
      };

      jobsDetailList.push({
        jobName: jobDef.name,
        title: meta.title,
        description: meta.desc,
        schedule: jobDef.schedule,
        status: inMem?.status || dbRun?.status || 'idle',
        lastRun: jobLastRun,
        nextRun: jobNextRun,
      });
    }

    const response: FreshnessResponse = {
      success: true,
      page,
      lastUpdated: latestUpdatedDate ? latestUpdatedDate.toISOString() : null,
      nextUpdate: nextScheduledRun ? nextScheduledRun.toISOString() : null,
      jobName: mostFrequentJobName,
      serverTime: now.toISOString(),
      jobs: jobsDetailList,
    };
    setCached(cacheKey, response, 60_000);
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
    });
  } catch (error) {
    console.error('[Data Freshness] Error fetching status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withApiTelemetry('GET', '/api/data/freshness', getHandler);

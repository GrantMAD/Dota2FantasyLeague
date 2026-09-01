/**
 * Cron Job Handler for Vercel
 * 
 * This endpoint is called by Vercel Cron to run scheduled jobs
 * Based on the time of day, different jobs are executed
 * 
 * Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAllJobs } from '@/lib/jobs/scheduler';

// Import all job functions
import { syncPlayers } from '@/lib/jobs/sync-players';
import { syncTeams } from '@/lib/jobs/sync-teams';
import { discoverTournaments } from '@/lib/jobs/discover-tournaments';
import { fetchMatches } from '@/lib/jobs/fetch-matches';
import { fetchMatchDetails } from '@/lib/jobs/fetch-match-details';
import { trackRosterChanges } from '@/lib/jobs/track-roster-changes';
import { processCompletedMatches } from '@/lib/jobs/process-completed-matches';
import { calculateFantasyScores } from '@/lib/jobs/calculate-fantasy-scores';
import { recalculateGameweeks } from '@/lib/jobs/recalculate-gameweeks';
import { updatePlayerPrices } from '@/lib/jobs/update-player-prices';

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing CRON_SECRET' },
      { status: 401 }
    );
  }

  const results: { jobName: string; status: string; error?: string }[] = [];
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();

  try {
    console.log(
      `[Cron] Running scheduled jobs at ${utcHour}:${utcMinute} UTC`
    );

    // 2 AM UTC - track roster changes
    if (utcHour === 2 && utcMinute === 0) {
      try {
        const result = await trackRosterChanges();
        results.push({
          jobName: 'track-roster-changes',
          status: result.errors.length === 0 ? 'success' : 'partial',
          error: result.errors.length > 0 ? result.errors[0] : undefined,
        });
      } catch (error) {
        results.push({
          jobName: 'track-roster-changes',
          status: 'failed',
          error: (error as Error).message,
        });
      }
    }

    // 3 AM UTC - sync players
    if (utcHour === 3 && utcMinute === 0) {
      try {
        const result = await syncPlayers();
        results.push({
          jobName: 'sync-players',
          status: result.errors.length === 0 ? 'success' : 'partial',
          error: result.errors.length > 0 ? result.errors[0] : undefined,
        });
      } catch (error) {
        results.push({
          jobName: 'sync-players',
          status: 'failed',
          error: (error as Error).message,
        });
      }
    }

    // 3:15 AM UTC - sync teams
    if (utcHour === 3 && utcMinute === 15) {
      try {
        const result = await syncTeams();
        results.push({
          jobName: 'sync-teams',
          status: result.errors.length === 0 ? 'success' : 'partial',
          error: result.errors.length > 0 ? result.errors[0] : undefined,
        });
      } catch (error) {
        results.push({
          jobName: 'sync-teams',
          status: 'failed',
          error: (error as Error).message,
        });
      }
    }

    // Every 6 hours - discover tournaments (0, 6, 12, 18 UTC)
    if (utcMinute === 0 && (utcHour % 6 === 0)) {
      try {
        const result = await discoverTournaments();
        results.push({
          jobName: 'discover-tournaments',
          status: result.errors.length === 0 ? 'success' : 'partial',
          error: result.errors.length > 0 ? result.errors[0] : undefined,
        });
      } catch (error) {
        results.push({
          jobName: 'discover-tournaments',
          status: 'failed',
          error: (error as Error).message,
        });
      }
    }

    // Every hour - fetch matches (at the top of every hour)
    if (utcMinute === 0) {
      try {
        const result = await fetchMatches();
        results.push({
          jobName: 'fetch-matches',
          status: result.errors.length === 0 ? 'success' : 'partial',
          error: result.errors.length > 0 ? result.errors[0] : undefined,
        });
      } catch (error) {
        results.push({
          jobName: 'fetch-matches',
          status: 'failed',
          error: (error as Error).message,
        });
      }
    }

    // Every 30 minutes - fetch match details (at :00 and :30)
    if (utcMinute === 0 || utcMinute === 30) {
      try {
        const result = await fetchMatchDetails();
        results.push({
          jobName: 'fetch-match-details',
          status: result.errors.length === 0 ? 'success' : 'partial',
          error: result.errors.length > 0 ? result.errors[0] : undefined,
        });
      } catch (error) {
        results.push({
          jobName: 'fetch-match-details',
          status: 'failed',
          error: (error as Error).message,
        });
      }
    }

    // Every 45 minutes - process completed matches (at :45)
    if (utcMinute === 45) {
      try {
        const result = await processCompletedMatches();
        results.push({
          jobName: 'process-completed-matches',
          status: result.success ? 'success' : 'partial',
          error: result.errors.length > 0 ? result.errors[0] : undefined,
        });
      } catch (error) {
        results.push({
          jobName: 'process-completed-matches',
          status: 'failed',
          error: (error as Error).message,
        });
      }
    }

    // Every 50 minutes - calculate fantasy scores (at :50)
    if (utcMinute === 50) {
      try {
        const result = await calculateFantasyScores();
        results.push({
          jobName: 'calculate-fantasy-scores',
          status: result.success ? 'success' : 'partial',
          error: result.errors.length > 0 ? result.errors[0] : undefined,
        });
      } catch (error) {
        results.push({
          jobName: 'calculate-fantasy-scores',
          status: 'failed',
          error: (error as Error).message,
        });
      }
    }

    // Every 55 minutes - recalculate gameweeks (at :55)
    if (utcMinute === 55) {
      try {
        const result = await recalculateGameweeks();
        results.push({
          jobName: 'recalculate-gameweeks',
          status: result.success ? 'success' : 'partial',
          error: result.errors.length > 0 ? result.errors[0] : undefined,
        });
      } catch (error) {
        results.push({
          jobName: 'recalculate-gameweeks',
          status: 'failed',
          error: (error as Error).message,
        });
      }
    }

    // Every 10 minutes after the score loop - recalculate player pricing (at :10, :20, :30, :40, :50, :00)
    if (utcMinute % 10 === 0) {
      try {
        const result = await updatePlayerPrices();
        results.push({
          jobName: 'update-player-prices',
          status: result.success ? 'success' : 'partial',
          error: result.errors.length > 0 ? result.errors[0] : undefined,
        });
      } catch (error) {
        results.push({
          jobName: 'update-player-prices',
          status: 'failed',
          error: (error as Error).message,
        });
      }
    }

    if (results.length === 0) {
      console.log('[Cron] No jobs scheduled for this time');
      return NextResponse.json({
        success: true,
        message: 'No jobs scheduled for this time',
        timestamp: now,
        hour: utcHour,
        minute: utcMinute,
      });
    }

    console.log(`[Cron] Executed ${results.length} jobs`);
    return NextResponse.json({
      success: true,
      message: `Executed ${results.length} scheduled jobs`,
      results,
      timestamp: now,
    });
  } catch (error) {
    console.error('[Cron] Error executing jobs:', error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        results,
        timestamp: now,
      },
      { status: 500 }
    );
  }
}

/**
 * Alternative: POST endpoint for manual cron trigger (for testing)
 * Can be called from external job runners like EasyCron, AWS Lambda, etc.
 */
export async function POST(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing CRON_SECRET' },
      { status: 401 }
    );
  }

  try {
    // Run all enabled jobs
    const results = await runAllJobs();
    return NextResponse.json({
      success: true,
      message: 'All jobs executed',
      results,
      timestamp: new Date(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }
}

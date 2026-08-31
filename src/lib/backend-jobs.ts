export type JobState = 'queued' | 'running' | 'completed' | 'blocked';

export interface ScheduledJob {
  name: string;
  schedule: string;
  status: JobState;
  nextRun: string;
  description: string;
}

export interface DeadlineCheck {
  gameweek: number;
  deadline: string;
  status: 'open' | 'warning' | 'locked';
  daysRemaining: number;
  message: string;
}

export interface PriceUpdate {
  playerId: number;
  playerName: string;
  previousPrice: number;
  currentPrice: number;
  delta: number;
}

export interface LeaderboardUpdate {
  playerName: string;
  previousRank: number;
  newRank: number;
  pointsDelta: number;
}

export interface IngestionSummary {
  source: string;
  recordsProcessed: number;
  status: 'success' | 'warning' | 'failed';
  note: string;
}

export interface AuditEvent {
  job: string;
  actor: string;
  status: 'success' | 'warning' | 'failed';
  detail: string;
  timestamp: string;
}

export function createBackgroundJob(
  name: string,
  schedule: string,
  status: JobState,
  nextRun: string,
  description: string,
): ScheduledJob {
  return {
    name,
    schedule,
    status,
    nextRun,
    description,
  };
}

export function enforceGameweekDeadline(deadline: string, now: string, gameweek = 6): DeadlineCheck {
  const deadlineTime = new Date(deadline).getTime();
  const nowTime = new Date(now).getTime();
  const differenceMs = deadlineTime - nowTime;
  const daysRemaining = Math.max(0, Math.ceil(differenceMs / (1000 * 60 * 60 * 24)));

  if (differenceMs <= 0) {
    return {
      gameweek,
      deadline,
      status: 'locked',
      daysRemaining: 0,
      message: 'The gameweek is locked and lineup changes are now disabled.',
    };
  }

  if (daysRemaining <= 1) {
    return {
      gameweek,
      deadline,
      status: 'warning',
      daysRemaining,
      message: 'Deadline is approaching. Final changes should be submitted soon.',
    };
  }

  return {
    gameweek,
    deadline,
    status: 'open',
    daysRemaining,
    message: 'The gameweek is still open for transfers and lineup changes.',
  };
}

export function runPriceUpdate(
  playerId: number,
  playerName: string,
  previousPrice: number,
  performanceDelta: number,
): PriceUpdate {
  const delta = Math.max(-8, Math.min(12, Math.round(performanceDelta * 0.7)));
  const currentPrice = Math.max(1, previousPrice + delta);

  return {
    playerId,
    playerName,
    previousPrice,
    currentPrice,
    delta,
  };
}

export function calculateSubstitutionImpact(
  startersMissing: number,
  benchAvailable: number,
): string {
  if (startersMissing === 0) {
    return 'No substitutions are required this gameweek.';
  }

  if (benchAvailable === 0) {
    return 'No eligible bench replacements are available, so the lineup remains locked.';
  }

  return `${Math.min(startersMissing, benchAvailable)} substitution${Math.min(startersMissing, benchAvailable) === 1 ? '' : 's'} can be processed against the eligible bench.`;
}

export function recalculateLeaderboard(
  playerName: string,
  previousRank: number,
  pointsDelta: number,
): LeaderboardUpdate {
  const newRank = previousRank - Math.max(0, Math.round(pointsDelta / 25));

  return {
    playerName,
    previousRank,
    newRank: Math.max(1, newRank),
    pointsDelta,
  };
}

export function ingestPlayerPerformance(
  source: string,
  recordsProcessed: number,
  isWarning = false,
): IngestionSummary {
  if (recordsProcessed === 0) {
    return {
      source,
      recordsProcessed: 0,
      status: 'failed',
      note: 'No player records were available from the feed.',
    };
  }

  return {
    source,
    recordsProcessed,
    status: isWarning ? 'warning' : 'success',
    note: isWarning
      ? 'Player performance records were ingested with some partial data checks.'
      : 'Player performance records were ingested successfully.',
  };
}

export function ingestMatchResults(
  source: string,
  recordsProcessed: number,
): IngestionSummary {
  if (recordsProcessed === 0) {
    return {
      source,
      recordsProcessed: 0,
      status: 'failed',
      note: 'No match results were received for the latest update window.',
    };
  }

  return {
    source,
    recordsProcessed,
    status: 'success',
    note: 'Match results were processed and synced to the scoring pipeline.',
  };
}

export function logAuditEvent(
  job: string,
  actor: string,
  status: 'success' | 'warning' | 'failed',
  detail: string,
  timestamp = new Date().toISOString(),
): AuditEvent {
  return {
    job,
    actor,
    status,
    detail,
    timestamp,
  };
}

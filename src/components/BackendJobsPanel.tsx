import {
  calculateSubstitutionImpact,
  createBackgroundJob,
  enforceGameweekDeadline,
  ingestMatchResults,
  ingestPlayerPerformance,
  logAuditEvent,
  recalculateLeaderboard,
  runPriceUpdate,
} from '@/lib/backend-jobs';

const jobs = [
  createBackgroundJob(
    'gameweek-sync',
    'every 15 minutes',
    'running',
    '2026-08-31T17:15:00Z',
    'Refreshes the current gameweek state and lock status.',
  ),
  createBackgroundJob(
    'price-refresh',
    'hourly',
    'queued',
    '2026-08-31T18:00:00Z',
    'Updates player valuations based on recent performance trends.',
  ),
];

const deadline = enforceGameweekDeadline('2026-09-02T00:00:00Z', '2026-08-31T12:00:00Z', 6);
const price = runPriceUpdate(14, 'Nova', 110, 7);
const leaderboard = recalculateLeaderboard('Alpha', 3, 32);
const ingest = ingestPlayerPerformance('OpenDota', 421);
const matchIngest = ingestMatchResults('Liquipedia', 18);
const audit = logAuditEvent('price-refresh', 'system', 'success', 'Updated player values after match resolution.');

export function BackendJobsPanel() {
  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <p className="text-sm uppercase tracking-wide text-amber-500 font-semibold mb-1">
          Phase 6
        </p>
        <h3 className="text-xl font-bold text-white mb-4">Backend Jobs and Ingestion</h3>

        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.name} className="rounded-md border border-slate-700 bg-slate-900/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-white font-semibold">{job.name}</p>
                <span className="text-xs uppercase tracking-wide text-amber-500">{job.status}</span>
              </div>
              <p className="text-sm text-slate-300 mt-1">{job.description}</p>
              <p className="text-xs text-slate-400 mt-2">Next run: {job.nextRun}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Gameweek Deadline</h3>
        <div className="rounded-md border border-slate-700 bg-slate-900/30 p-3">
          <p className="text-slate-400 text-xs uppercase tracking-wide">Status</p>
          <p className="text-white font-semibold mt-1">{deadline.status}</p>
          <p className="text-sm text-slate-300">{deadline.message}</p>
          <p className="text-xs text-slate-400 mt-2">{deadline.daysRemaining} days remaining</p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Live Pipeline</h3>
        <div className="space-y-3">
          <div className="rounded-md border border-slate-700 bg-slate-900/30 p-3">
            <p className="text-slate-400 text-xs uppercase tracking-wide">Price Update</p>
            <p className="text-white font-semibold mt-1">{price.playerName}</p>
            <p className="text-sm text-slate-300">
              {price.previousPrice} → {price.currentPrice} ({price.delta > 0 ? '+' : ''}
              {price.delta})
            </p>
          </div>

          <div className="rounded-md border border-slate-700 bg-slate-900/30 p-3">
            <p className="text-slate-400 text-xs uppercase tracking-wide">Leaderboard Recalc</p>
            <p className="text-white font-semibold mt-1">{leaderboard.playerName}</p>
            <p className="text-sm text-slate-300">
              Rank {leaderboard.previousRank} → {leaderboard.newRank}
            </p>
          </div>

          <div className="rounded-md border border-slate-700 bg-slate-900/30 p-3">
            <p className="text-slate-400 text-xs uppercase tracking-wide">Data Ingestion</p>
            <p className="text-white font-semibold mt-1">{ingest.source}</p>
            <p className="text-sm text-slate-300">{ingest.recordsProcessed} records processed</p>
          </div>

          <div className="rounded-md border border-slate-700 bg-slate-900/30 p-3">
            <p className="text-slate-400 text-xs uppercase tracking-wide">Match Results</p>
            <p className="text-white font-semibold mt-1">{matchIngest.source}</p>
            <p className="text-sm text-slate-300">{matchIngest.recordsProcessed} results processed</p>
          </div>

          <div className="rounded-md border border-slate-700 bg-slate-900/30 p-3">
            <p className="text-slate-400 text-xs uppercase tracking-wide">Audit</p>
            <p className="text-white font-semibold mt-1">{audit.job}</p>
            <p className="text-sm text-slate-300">{audit.detail}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Substitution Logic</h3>
        <p className="text-sm text-slate-300">{calculateSubstitutionImpact(2, 1)}</p>
      </div>
    </div>
  );
}

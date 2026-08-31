import {
  buildSeasonSummary,
  calculateLeaderboard,
  resolveBenchSubstitution,
  simulateHeadToHead,
  simulatePriceDynamics,
  summarizePlayerPerformance,
  type BenchPlayer,
  type StarterSlot,
} from '@/lib/fantasy-gameplay';

const starters: StarterSlot[] = [
  { id: 1, name: 'Aegis', role: 'Carry', available: false, points: 32 },
  { id: 2, name: 'Beacon', role: 'Mid', available: true, points: 32 },
  { id: 3, name: 'Cinder', role: 'Support', available: true, points: 18 },
];

const bench: BenchPlayer[] = [
  { id: 4, name: 'Dusk', role: 'Carry', available: true, points: 26 },
  { id: 5, name: 'Ember', role: 'Support', available: true, points: 21 },
];

const leaderboard = calculateLeaderboard([
  { manager: 'Alpha', points: 1200, wins: 7, losses: 2 },
  { manager: 'Bravo', points: 1160, wins: 6, losses: 3 },
  { manager: 'Charlie', points: 1105, wins: 5, losses: 4 },
]);

const seasonSummary = buildSeasonSummary('Season 2026', 3, 1420, 2, 7);
const priceUpdate = simulatePriceDynamics(12, 'Aegis', 100, 12);
const headToHead = simulateHeadToHead('Storm', 'Nova', 81, 74);
const playerSummary = summarizePlayerPerformance('Aegis', 5, 31.4, 6, 42);

export function FantasyGameweekPanel() {
  const substitutions = resolveBenchSubstitution(starters, bench);

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <p className="text-sm uppercase tracking-wide text-amber-500 font-semibold mb-1">
          Phase 5
        </p>
        <h3 className="text-xl font-bold text-white mb-4">Business Logic</h3>

        <div className="space-y-3">
          <div className="rounded-md border border-slate-700 bg-slate-900/30 p-3">
            <p className="text-slate-400 text-xs uppercase tracking-wide">Bench Substitution</p>
            <p className="text-white font-semibold mt-1">
              {substitutions[0]?.replacement ?? 'No substitution'}
            </p>
            <p className="text-sm text-slate-300">{substitutions[0]?.reason}</p>
          </div>

          <div className="rounded-md border border-slate-700 bg-slate-900/30 p-3">
            <p className="text-slate-400 text-xs uppercase tracking-wide">Season Snapshot</p>
            <p className="text-white font-semibold mt-1">{seasonSummary.totalPoints} pts</p>
            <p className="text-sm text-slate-300">{seasonSummary.activeSquadCount} active squad members</p>
          </div>

          <div className="rounded-md border border-slate-700 bg-slate-900/30 p-3">
            <p className="text-slate-400 text-xs uppercase tracking-wide">Price Movement</p>
            <p className="text-white font-semibold mt-1">{priceUpdate.playerName}</p>
            <p className="text-sm text-slate-300">
              {priceUpdate.previousPrice} → {priceUpdate.currentPrice} ({priceUpdate.change > 0 ? '+' : ''}
              {priceUpdate.change})
            </p>
          </div>

          <div className="rounded-md border border-slate-700 bg-slate-900/30 p-3">
            <p className="text-slate-400 text-xs uppercase tracking-wide">H2H Matchup</p>
            <p className="text-white font-semibold mt-1">{headToHead.winner}</p>
            <p className="text-sm text-slate-300">{headToHead.summary}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Leaderboard</h3>
        <div className="space-y-2">
          {leaderboard.map((entry) => (
            <div
              key={entry.manager}
              className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-900/30 px-3 py-2"
            >
              <div>
                <p className="text-white font-semibold">#{entry.rank} {entry.manager}</p>
                <p className="text-xs text-slate-400">{entry.wins}W {entry.losses}L</p>
              </div>
              <span className="text-amber-500 font-bold">{entry.points}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Player Tracking</h3>
        <div className="rounded-md border border-slate-700 bg-slate-900/30 p-3">
          <p className="text-white font-semibold">{playerSummary.playerName}</p>
          <p className="text-sm text-slate-300">
            {playerSummary.matches} matches • {playerSummary.averagePoints.toFixed(1)} avg • Recent {playerSummary.recentScore}
          </p>
        </div>
      </div>
    </div>
  );
}

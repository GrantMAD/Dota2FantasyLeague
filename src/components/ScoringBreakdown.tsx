import { calculateFantasyScore, type FantasyPerformanceInput } from '@/lib/scoring';

const samplePerformance: FantasyPerformanceInput = {
  kills: 12,
  deaths: 5,
  assists: 16,
  lastHits: 336,
  denies: 17,
  goldPerMinute: 620,
  experiencePerMinute: 540,
  heroDamage: 18500,
  buildingDamage: 9600,
  healing: 4500,
  wardsPlaced: 11,
  wardsDestroyed: 6,
  performanceIndex: 88,
  gameCount: 3,
  hasWin: true,
};

export function ScoringBreakdown() {
  const score = calculateFantasyScore(samplePerformance);

  const breakdown = [
    { label: 'Combat', value: score.combat },
    { label: 'Economy', value: score.economy },
    { label: 'Objectives', value: score.objective },
    { label: 'Teamfight', value: score.teamfight },
    { label: 'Win Bonus', value: score.win },
    { label: 'Series Bonus', value: score.series },
    { label: 'Performance', value: score.performance },
    { label: 'Consistency', value: score.consistency },
    { label: 'Penalty', value: -score.penalties },
  ];

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm uppercase tracking-wide text-amber-500 font-semibold mb-1">
            Phase 5
          </p>
          <h3 className="text-xl font-bold text-white">Fantasy Scoring</h3>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-xs">Gameweek total</p>
          <p className="text-3xl font-bold text-amber-500">{score.total.toFixed(1)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {breakdown.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-900/30 px-3 py-2"
          >
            <span className="text-slate-300 text-sm">{item.label}</span>
            <span
              className={`font-semibold text-sm ${item.value >= 0 ? 'text-white' : 'text-red-400'}`}
            >
              {item.value > 0 ? '+' : ''}
              {item.value.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

import { resolveCaptainAssignment, type CaptainCandidate } from '@/lib/captain-system';

const samplePlayers: CaptainCandidate[] = [
  { id: 1, name: 'Aegis', role: 'Carry', available: true },
  { id: 2, name: 'Beacon', role: 'Mid', available: true },
  { id: 3, name: 'Cinder', role: 'Offlane', available: false },
  { id: 4, name: 'Dusk', role: 'Support', available: true },
];

export function CaptainSystem() {
  const result = resolveCaptainAssignment(samplePlayers, 1, 2);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <div className="mb-5">
        <p className="text-sm uppercase tracking-wide text-amber-500 font-semibold mb-1">
          Phase 5
        </p>
        <h3 className="text-xl font-bold text-white">Captain and Vice Captain</h3>
      </div>

      <div className="space-y-3">
        <div className="rounded-md border border-slate-700 bg-slate-900/30 p-3">
          <p className="text-slate-400 text-xs uppercase tracking-wide">Captain</p>
          <p className="text-white font-semibold">{result.captain.name}</p>
          <p className="text-amber-500 font-medium">{result.captainMultiplier}x multiplier</p>
        </div>

        <div className="rounded-md border border-slate-700 bg-slate-900/30 p-3">
          <p className="text-slate-400 text-xs uppercase tracking-wide">Vice Captain</p>
          <p className="text-white font-semibold">{result.viceCaptain?.name ?? 'Unavailable'}</p>
          <p className="text-slate-300 font-medium">{result.viceMultiplier}x multiplier</p>
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-300">{result.note}</p>
    </div>
  );
}

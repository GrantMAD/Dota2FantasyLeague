'use client';

export default function LineupsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">Lineups</h1>
      <p className="text-slate-400 mb-8">Set your starting XI for each gameweek</p>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
        <div className="text-5xl mb-4">📋</div>
        <h3 className="text-xl font-semibold text-white mb-2">No Active Lineups</h3>
        <p className="text-slate-400">Create a squad first to set your lineups</p>
      </div>
    </div>
  );
}

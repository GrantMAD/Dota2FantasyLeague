'use client';

export default function PlayersPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">Professional Players</h1>
      <p className="text-slate-400 mb-8">Browse all professional Dota 2 players</p>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8">
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search players..."
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="text-center py-12">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="text-xl font-semibold text-white mb-2">Loading Players</h3>
          <p className="text-slate-400">Browse and view player statistics and prices</p>
        </div>
      </div>
    </div>
  );
}

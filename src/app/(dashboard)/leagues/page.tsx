'use client';

export default function LeaguesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Leagues</h1>
          <p className="text-slate-400">Compete with friends and players worldwide</p>
        </div>
        <button className="bg-linear-to-r from-amber-500 to-orange-600 text-white px-6 py-2 rounded-lg font-semibold">
          Create League
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
        <div className="text-5xl mb-4">🏆</div>
        <h3 className="text-xl font-semibold text-white mb-2">No Leagues Yet</h3>
        <p className="text-slate-400">Create or join a league to compete with others</p>
      </div>
    </div>
  );
}

'use client';

export default function SquadsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Squad Management</h1>
        <p className="text-slate-400">Manage and create your fantasy squads</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
          <div className="text-5xl mb-4">➕</div>
          <h3 className="text-xl font-semibold text-white mb-2">Create Squad</h3>
          <p className="text-slate-400 mb-4">Start building your fantasy team</p>
          <button className="bg-linear-to-r from-amber-500 to-orange-600 text-white px-6 py-2 rounded-lg font-semibold">
            New Squad
          </button>
        </div>
      </div>
    </div>
  );
}

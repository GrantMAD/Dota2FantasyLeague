import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 to-slate-900 flex flex-col">
      {/* Header/Nav */}
      <header className="border-b border-slate-700 bg-slate-900/95 backdrop-blur">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <div className="w-8 h-8 bg-linear-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">D2</span>
            </div>
            <span className="bg-linear-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
              Fantasy Dota 2
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center text-slate-300 hover:text-white font-medium transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="bg-linear-to-r from-amber-500 to-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg hover:shadow-orange-500/20 transition-all"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        <div className="max-w-3xl text-center">
          <div className="mb-8 inline-block">
            <div className="w-24 h-24 bg-linear-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center">
              <span className="text-white font-bold text-5xl">D2</span>
            </div>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Fantasy Dota 2
          </h1>

          <p className="text-xl text-slate-300 mb-8">
            Build your ultimate Dota 2 fantasy squad. Manage your budget, transfer players, and compete against the world.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              href="/signup"
              className="bg-linear-to-r from-amber-500 to-orange-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:shadow-lg hover:shadow-orange-500/20 transition-all"
            >
              Create Free Account
            </Link>
            <Link
              href="/login"
              className="border-2 border-amber-500 text-amber-500 px-8 py-4 rounded-lg font-bold text-lg hover:bg-amber-500/10 transition-all"
            >
              Sign In
            </Link>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-lg font-semibold text-white mb-2">Build Your Squad</h3>
              <p className="text-slate-400">
                Assemble a team of real professional Dota 2 players within your budget
              </p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-semibold text-white mb-2">Live Scoring</h3>
              <p className="text-slate-400">
                Earn fantasy points based on actual match performances and statistics
              </p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-lg font-semibold text-white mb-2">Global Leagues</h3>
              <p className="text-slate-400">
                Compete with players worldwide in head-to-head and total points leagues
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-16 pt-16 border-t border-slate-700">
            <div>
              <p className="text-3xl font-bold text-amber-500">100M</p>
              <p className="text-slate-400 text-sm">Starting Budget</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-500">8</p>
              <p className="text-slate-400 text-sm">Players per Squad</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-500">∞</p>
              <p className="text-slate-400 text-sm">Players Worldwide</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-900/50 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-slate-400 text-sm">
          <p>
            Fantasy Dota 2 • Global Fantasy Esports Platform
          </p>
        </div>
      </footer>
    </div>
  );
}

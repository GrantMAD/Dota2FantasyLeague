import Link from 'next/link';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';

export const metadata = {
  title: 'Fantasy Dota 2 | Global Fantasy Esports Platform',
  description: 'Build your ultimate Dota 2 fantasy squad. Manage your budget, transfer players, and compete against the world.',
};

export default async function Home() {
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(
    cookieStore.get('sb-auth-token')?.value ||
    cookieStore.get('sb-refresh-token')?.value
  );

  // Fetch real stats
  const [playersRes, teamsRes] = await Promise.all([
    supabase.from('professional_players').select('*', { count: 'exact', head: true }),
    supabase.from('professional_teams').select('*', { count: 'exact', head: true })
  ]);

  const playerCount = playersRes.count ? `${playersRes.count.toLocaleString()}+` : '4,600+';
  const teamCount = teamsRes.count ? teamsRes.count.toLocaleString() : '98';

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 to-slate-900 flex flex-col">
      {/* Header/Nav */}
      <header className="border-b border-slate-700 bg-slate-900/95 backdrop-blur sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl group">
            <div className="w-8 h-8 bg-linear-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
              <span className="text-white font-bold">D2</span>
            </div>
            <span className="bg-linear-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent group-hover:from-amber-400 group-hover:to-orange-500 transition-colors">
              Fantasy Dota 2
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="bg-linear-to-r from-amber-500 to-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg hover:shadow-orange-500/20 transition-all active:scale-95"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center text-slate-300 hover:text-white font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="bg-linear-to-r from-amber-500 to-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg hover:shadow-orange-500/20 transition-all active:scale-95"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        <div className="max-w-4xl text-center w-full">
          <div className="mb-8 inline-block animate-bounce-slow">
            <div className="w-24 h-24 bg-linear-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <span className="text-white font-bold text-5xl">D2</span>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
            Fantasy Dota 2
          </h1>

          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            Build your ultimate Dota 2 fantasy squad. Manage your budget, transfer players, and compete against the world.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-24">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="bg-linear-to-r from-amber-500 to-orange-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all hover:-translate-y-1 active:translate-y-0"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="bg-linear-to-r from-amber-500 to-orange-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all hover:-translate-y-1 active:translate-y-0"
                >
                  Create Free Account
                </Link>
                <Link
                  href="/login"
                  className="border-2 border-amber-500/50 text-amber-500 px-8 py-4 rounded-xl font-bold text-lg hover:bg-amber-500/10 hover:border-amber-500 transition-all"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>

          {/* Features */}
          <div className="mb-24 text-left">
            <h2 className="text-3xl font-bold text-white text-center mb-12">Why Play Fantasy Dota 2?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 hover:border-amber-500/50 hover:bg-slate-800/60 transition-all duration-300 group">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">📈</div>
                <h3 className="text-lg font-semibold text-white mb-2">Live Pro Data</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Powered by real-time match statistics. Every kill, assist, and objective directly impacts your score.
                </p>
              </div>

              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 hover:border-amber-500/50 hover:bg-slate-800/60 transition-all duration-300 group">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">🏆</div>
                <h3 className="text-lg font-semibold text-white mb-2">Compete in Leagues</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Join public global leagues or create private head-to-head leagues with your friends.
                </p>
              </div>

              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 hover:border-amber-500/50 hover:bg-slate-800/60 transition-all duration-300 group">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">💰</div>
                <h3 className="text-lg font-semibold text-white mb-2">Dynamic Pricing</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Player values fluctuate based on their real-world performance. Buy low, sell high.
                </p>
              </div>

              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 hover:border-amber-500/50 hover:bg-slate-800/60 transition-all duration-300 group">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">⚔️</div>
                <h3 className="text-lg font-semibold text-white mb-2">Fantasy Scoring</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Advanced scoring algorithm rewarding diverse playstyles across cores and supports.
                </p>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="mb-24">
            <h2 className="text-3xl font-bold text-white text-center mb-16">How It Works</h2>
            <div className="flex flex-col md:flex-row items-start justify-center gap-12 relative max-w-5xl mx-auto">
              {/* Connector line (hidden on mobile) */}
              <div className="hidden md:block absolute top-8 left-[15%] right-[15%] h-0.5 bg-linear-to-r from-amber-500/10 via-amber-500/40 to-amber-500/10 -z-10"></div>
              
              <div className="flex flex-col items-center w-full md:w-1/3 bg-slate-900/50 backdrop-blur-xs z-10 px-4 group">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 font-bold text-2xl flex items-center justify-center mb-6 ring-1 ring-amber-500/30 group-hover:bg-amber-500 group-hover:text-slate-900 group-hover:ring-amber-500 transition-all duration-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]">1</div>
                <h3 className="text-xl font-bold text-white mb-3">Build Squad</h3>
                <p className="text-slate-400 text-center text-sm leading-relaxed">Draft an 8-player roster using your 100M budget. Choose players from real pro teams.</p>
              </div>

              <div className="flex flex-col items-center w-full md:w-1/3 bg-slate-900/50 backdrop-blur-xs z-10 px-4 group">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 font-bold text-2xl flex items-center justify-center mb-6 ring-1 ring-amber-500/30 group-hover:bg-amber-500 group-hover:text-slate-900 group-hover:ring-amber-500 transition-all duration-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]">2</div>
                <h3 className="text-xl font-bold text-white mb-3">Set Lineup</h3>
                <p className="text-slate-400 text-center text-sm leading-relaxed">Pick 5 starters for the gameweek and choose a Captain to earn 2x points.</p>
              </div>

              <div className="flex flex-col items-center w-full md:w-1/3 bg-slate-900/50 backdrop-blur-xs z-10 px-4 group">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 font-bold text-2xl flex items-center justify-center mb-6 ring-1 ring-amber-500/30 group-hover:bg-amber-500 group-hover:text-slate-900 group-hover:ring-amber-500 transition-all duration-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]">3</div>
                <h3 className="text-xl font-bold text-white mb-3">Earn Points</h3>
                <p className="text-slate-400 text-center text-sm leading-relaxed">Watch the live matches and climb the global leaderboard as your players perform.</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-16 py-12 border-t border-slate-700/50">
            <div className="flex flex-col items-center justify-center p-6 bg-slate-800/20 rounded-2xl">
              <p className="text-4xl md:text-5xl font-bold text-amber-500 mb-2">{playerCount}</p>
              <p className="text-slate-400 text-sm font-semibold uppercase tracking-widest">Pro Players</p>
            </div>
            <div className="flex flex-col items-center justify-center p-6 bg-slate-800/20 rounded-2xl">
              <p className="text-4xl md:text-5xl font-bold text-amber-500 mb-2">{teamCount}</p>
              <p className="text-slate-400 text-sm font-semibold uppercase tracking-widest">Pro Teams</p>
            </div>
            <div className="flex flex-col items-center justify-center p-6 bg-slate-800/20 rounded-2xl">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                <p className="text-4xl md:text-5xl font-bold text-amber-500">Live</p>
              </div>
              <p className="text-slate-400 text-sm font-semibold uppercase tracking-widest">Match Data</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-8 px-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-slate-500 text-sm">
          <p className="mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Fantasy Dota 2. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/help" className="hover:text-amber-500 transition-colors">Help</Link>
            <Link href="/rules" className="hover:text-amber-500 transition-colors">Rules</Link>
            <Link href="/privacy" className="hover:text-amber-500 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-amber-500 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

import Link from 'next/link';
import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabase';
import { LandingStats } from '@/components/LandingStats';

function DotaLogoMark() {
  return (
    <svg viewBox="0 0 64 64" className="h-9 w-9 overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="dota-mark" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <rect x="5" y="5" width="54" height="54" rx="16" fill="url(#dota-mark)" />
      <path d="M21 18h16c8.8 0 16 7.2 16 16s-7.2 16-16 16H21V18zm8 8v16h8c4.4 0 8-3.6 8-8s-3.6-8-8-8h-8z" fill="#fff" opacity="0.96" />
      <path d="M22 23l10 10-10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.85" />
    </svg>
  );
}

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

  const supabase = supabaseServer();

  const [playersRes, teamsRes] = await Promise.all([
    supabase.from('professional_players').select('*', { count: 'exact', head: true }),
    supabase.from('professional_teams').select('*', { count: 'exact', head: true })
  ]);

  const playerCount = playersRes.count ?? 4600;
  const teamCount = teamsRes.count ?? 98;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_35%),linear-gradient(180deg,_#020817_0%,_#0f172a_100%)] text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-700/80 bg-slate-900/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3 font-bold text-xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950/80 ring-1 ring-amber-500/40 shadow-[0_0_25px_rgba(245,158,11,0.18)] transition-transform group-hover:scale-105">
              <DotaLogoMark />
            </div>
            <span className="bg-linear-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent transition-colors group-hover:from-amber-300 group-hover:to-orange-400">
              Fantasy Dota 2
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2 font-medium text-white shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 hover:shadow-orange-500/30 active:translate-y-0"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="font-medium text-slate-300 transition-colors hover:text-white">
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2 font-medium text-white shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 hover:shadow-orange-500/30 active:translate-y-0"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20">
        <div className="relative w-full max-w-6xl">
          <div className="pointer-events-none absolute left-1/2 top-10 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="pointer-events-none absolute right-10 top-40 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mb-8 inline-flex h-28 w-28 items-center justify-center rounded-3xl border border-amber-500/40 bg-slate-900/70 shadow-[0_0_35px_rgba(245,158,11,0.18)] backdrop-blur-sm animate-[float_6s_ease-in-out_infinite]">
              <DotaLogoMark />
            </div>

            <div className="mb-6 inline-flex rounded-full border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-200">
              Global Fantasy Esports
            </div>

            <h1 className="mb-6 text-5xl font-black tracking-tight text-white md:text-7xl">
              Fantasy Dota 2
            </h1>

            <p className="mx-auto max-w-2xl text-xl text-slate-300 md:text-2xl">
              Build your dream lineup, track real-world performance, and outmaneuver rivals in the next gameweek.
            </p>

            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-orange-500/25 transition-all hover:-translate-y-1 hover:shadow-orange-500/35 active:translate-y-0"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-orange-500/25 transition-all hover:-translate-y-1 hover:shadow-orange-500/35 active:translate-y-0"
                  >
                    Create Free Account
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-xl border border-amber-500/50 bg-amber-500/5 px-8 py-4 text-lg font-bold text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-500/10"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="mt-20 mb-20 text-left">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-white">Why Play Fantasy Dota 2?</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {[
                { emoji: '📈', title: 'Live Pro Data', text: 'Track real-time stats, performances, and gameweek momentum as matches evolve.' },
                { emoji: '🏆', title: 'Compete in Leagues', text: 'Challenge friends, join public leagues, and climb the leaderboard against global managers.' },
                { emoji: '💰', title: 'Dynamic Pricing', text: 'Transfer players strategically as market value shifts with form, injuries, and role changes.' },
                { emoji: '⚔️', title: 'Fantasy Scoring', text: 'Build a smarter squad around points, consistency, and lineup advantage across the week.' },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="group rounded-2xl border border-slate-700/60 bg-slate-900/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/50 hover:bg-slate-900/80"
                >
                  <div className="mb-4 text-4xl transition-transform duration-300 group-hover:scale-110">{feature.emoji}</div>
                  <h3 className="mb-2 text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-20">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold text-white">How It Works</h2>
            </div>
            <div className="relative mx-auto flex max-w-5xl flex-col gap-8 md:flex-row md:items-start md:justify-center">
              <div className="hidden md:block absolute top-8 left-[15%] right-[15%] h-0.5 bg-linear-to-r from-transparent via-amber-500/40 to-transparent" />
              {[
                { number: '1', title: 'Build Squad', text: 'Create an eight-player roster using your budget and choose the strongest fit for your strategy.' },
                { number: '2', title: 'Set Lineup', text: 'Lock in your five starters, captain, and vice-captain before the gameweek deadline.' },
                { number: '3', title: 'Earn Points', text: 'Monitor the live results and climb rankings as your squad produces returns across the week.' },
              ].map((step) => (
                <div key={step.number} className="relative z-10 w-full md:w-1/3">
                  <div className="rounded-3xl border border-slate-700/70 bg-slate-900/60 p-6 text-center shadow-[0_20px_45px_rgba(15,23,42,0.25)] transition-all duration-300 hover:border-amber-500/50 hover:bg-slate-900/80">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-2xl font-black text-amber-300 ring-1 ring-amber-500/30 transition-all duration-300 group-hover:bg-amber-500 group-hover:text-slate-900">
                      {step.number}
                    </div>
                    <h3 className="mb-3 text-xl font-bold text-white">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-slate-400">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <LandingStats playerCount={playerCount} teamCount={teamCount} />
        </div>
      </main>

      <footer className="mt-auto border-t border-slate-800 bg-slate-950/90 px-4 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-slate-500 md:flex-row">
          <p>&copy; {new Date().getFullYear()} Fantasy Dota 2. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/help" className="transition-colors hover:text-amber-400">Help</Link>
            <Link href="/rules" className="transition-colors hover:text-amber-400">Rules</Link>
            <Link href="/privacy" className="transition-colors hover:text-amber-400">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-amber-400">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

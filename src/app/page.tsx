import Link from 'next/link';
import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabase';
import { LandingStats } from '@/components/LandingStats';
import { ParticleCanvas } from '@/components/landing/ParticleCanvas';
import { CountdownTimer } from '@/components/landing/CountdownTimer';
import { TeamMarquee } from '@/components/landing/TeamMarquee';
import { MockSquadCard } from '@/components/landing/MockSquadCard';
import { HowItWorksTabs } from '@/components/landing/HowItWorksTabs';
import { TestimonialsStrip } from '@/components/landing/TestimonialsStrip';
import { BrandLogo } from '@/components/BrandLogo';

export const metadata = {
  title: 'Fantasy Dota 2 | Global Fantasy Esports Platform',
  description:
    'Build your ultimate Dota 2 fantasy squad. Manage your budget, transfer players, and compete against the world.',
};

const FEATURES = [
  {
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
      </svg>
    ),
    title: 'Live Pro Data',
    text: 'Track real-time stats, performances, and gameweek momentum as matches evolve across every DPC region.',
    accent: 'amber',
  },
  {
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    ),
    title: 'Compete in Leagues',
    text: 'Challenge friends, join public leagues, and climb the global leaderboard against managers from every region.',
    accent: 'cyan',
  },
  {
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: 'Dynamic Pricing',
    text: 'Transfer players strategically as market value shifts with form, injuries, and role changes throughout the season.',
    accent: 'violet',
  },
  {
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: 'Fantasy Scoring',
    text: 'Build a smarter squad around 15+ metrics — kills, net worth, GPM, tower damage, and more.',
    accent: 'emerald',
  },
];

const ACCENT_MAP: Record<string, string> = {
  amber:  'text-amber-400  bg-amber-500/10  ring-amber-500/20  group-hover:border-amber-500/40',
  cyan:   'text-cyan-400   bg-cyan-500/10   ring-cyan-500/20   group-hover:border-cyan-500/40',
  violet: 'text-violet-400 bg-violet-500/10 ring-violet-500/20 group-hover:border-violet-500/40',
  emerald:'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20 group-hover:border-emerald-500/40',
};

// Next gameweek deadline — always the upcoming Monday 18:00 UTC
function getNextDeadline(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun ... 6=Sat
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  const deadline = new Date(now);
  deadline.setUTCDate(now.getUTCDate() + daysUntilMonday);
  deadline.setUTCHours(18, 0, 0, 0);
  return deadline;
}

export default async function Home() {
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(
    cookieStore.get('sb-auth-token')?.value ||
    cookieStore.get('sb-refresh-token')?.value,
  );

  const supabase = supabaseServer();
  const [playersRes, teamsRes] = await Promise.all([
    supabase.from('professional_players').select('*', { count: 'exact', head: true }),
    supabase.from('professional_teams').select('*', { count: 'exact', head: true }),
  ]);

  const playerCount = playersRes.count ?? 4600;
  const teamCount   = teamsRes.count  ?? 98;
  const deadline    = getNextDeadline();

  return (
    <div
      className="min-h-screen text-slate-100"
      style={{ background: 'linear-gradient(180deg, #05080f 0%, #08101e 50%, #0a1428 100%)' }}
    >
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl"
        style={{ background: 'rgba(5, 8, 15, 0.85)' }}>
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3 font-bold text-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950/80 ring-1 ring-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)] transition-all group-hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] group-hover:ring-amber-400/60">
              <BrandLogo className="h-8 w-8" priority />
            </div>
            <span className="bg-linear-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              Fantasy Dota 2
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 hover:shadow-orange-500/35"
              >
                Dashboard &rarr;
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 hover:shadow-orange-500/35"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        {/* CINEMATIC HERO */}
        <section className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-4 py-20">
          <ParticleCanvas />

          {/* Ambient orbs */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/4 h-175 w-175 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.04) 50%, transparent 70%)' }}
          />
          <div
            className="pointer-events-none absolute right-0 top-1/3 h-125 w-125 translate-x-1/3 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 70%)' }}
          />
          <div
            className="pointer-events-none absolute bottom-0 left-0 h-100 w-100 -translate-x-1/3 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)' }}
          />

          <div className="relative z-10 mx-auto w-full max-w-6xl">
            <div className="grid items-center gap-16 lg:grid-cols-2">
              {/* Left text */}
              <div className="flex flex-col items-start text-left">
                <div className="animate-fade-up mb-6 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Season 2026 Live
                  </span>
                  <CountdownTimer targetDate={deadline} />
                </div>

                <h1 className="animate-fade-up-delay-1 mb-6 text-5xl font-black leading-[1.05] tracking-tight text-white md:text-7xl">
                  Pick Smarter.{' '}
                  <span className="block bg-linear-to-r from-amber-400 via-orange-400 to-amber-300 bg-clip-text text-transparent">
                    Score Bigger.
                  </span>
                </h1>

                <p className="animate-fade-up-delay-2 mb-10 max-w-xl text-lg leading-relaxed text-slate-400 md:text-xl">
                  Build your ultimate Dota 2 fantasy squad from{' '}
                  <span className="font-semibold text-amber-400">{playerCount.toLocaleString()}+ pro players</span>,
                  set your lineup before the deadline, and battle managers worldwide for glory.
                </p>

                <div className="animate-fade-up-delay-3 flex flex-col gap-4 sm:flex-row">
                  {isLoggedIn ? (
                    <Link
                      href="/dashboard"
                      id="hero-dashboard-cta"
                      className="animate-glow-pulse inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-amber-500 to-orange-600 px-8 py-4 text-lg font-black text-white transition-all hover:-translate-y-1 hover:from-amber-400 hover:to-orange-500"
                    >
                      Go to Dashboard
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </Link>
                  ) : (
                    <>
                      <Link
                        href="/signup"
                        id="hero-signup-cta"
                        className="animate-glow-pulse inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-amber-500 to-orange-600 px-8 py-4 text-lg font-black text-white transition-all hover:-translate-y-1 hover:from-amber-400 hover:to-orange-500"
                      >
                        Create Free Account
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                      </Link>
                      <Link
                        href="/login"
                        id="hero-login-cta"
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-600/60 bg-slate-900/60 px-8 py-4 text-lg font-bold text-slate-200 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-800/80"
                      >
                        Sign In
                      </Link>
                    </>
                  )}
                </div>

                {/* Trust row */}
                <div className="animate-fade-up-delay-3 mt-8 flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-500">
                  {['Free to play', 'No credit card required', 'Live match data'].map((t) => (
                    <span key={t} className="flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right — mock squad card */}
              <div className="animate-fade-up-delay-2 flex justify-center lg:justify-end">
                <div className="animate-float w-full">
                  <MockSquadCard />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TEAM MARQUEE */}
        <TeamMarquee />

        {/* FEATURES */}
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <span className="mb-4 inline-block rounded-full border border-cyan-500/25 bg-cyan-500/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-400">
              Why Fantasy Dota 2
            </span>
            <h2 className="text-4xl font-black text-white md:text-5xl">
              Built for the{' '}
              <span className="bg-linear-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">
                serious fan
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              Everything you need to make informed picks, outsmart rivals, and dominate your league every week.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map((f) => {
              const accentClass = ACCENT_MAP[f.accent];
              return (
                <div
                  key={f.title}
                  className={`group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-slate-900/80 ${accentClass}`}
                >
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer" />
                  <div className={`mb-5 inline-flex rounded-xl p-3 ring-1 ${accentClass}`}>
                    {f.icon}
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-white">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{f.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-t border-slate-800/60 bg-slate-950/40 px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-14 text-center">
              <span className="mb-4 inline-block rounded-full border border-amber-500/25 bg-amber-500/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-400">
                Getting Started
              </span>
              <h2 className="text-4xl font-black text-white md:text-5xl">
                How it{' '}
                <span className="bg-linear-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  works
                </span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-slate-400">
                Go from zero to competing in under five minutes.
              </p>
            </div>
            <HowItWorksTabs />
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <span className="mb-4 inline-block rounded-full border border-violet-500/25 bg-violet-500/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-violet-400">
              Community
            </span>
            <h2 className="text-4xl font-black text-white md:text-5xl">
              Managers who{' '}
              <span className="bg-linear-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                love it
              </span>
            </h2>
          </div>
          <TestimonialsStrip />
        </section>

        {/* STATS BAR */}
        <section className="border-t border-slate-800/60 bg-slate-950/40 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <LandingStats playerCount={playerCount} teamCount={teamCount} />
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="relative overflow-hidden px-4 py-28 sm:px-6 lg:px-8">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(245,158,11,0.12) 0%, transparent 70%)' }}
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <div className="animate-float mb-8 inline-flex h-24 w-24 items-center justify-center rounded-3xl border border-amber-500/40 bg-slate-900/70 shadow-[0_0_50px_rgba(245,158,11,0.2)] backdrop-blur-sm">
              <BrandLogo className="h-20 w-20" />
            </div>
            <h2 className="mb-4 text-4xl font-black text-white md:text-5xl">
              Ready to build your{' '}
              <span className="bg-linear-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                dream squad?
              </span>
            </h2>
            <p className="mb-10 text-lg text-slate-400">
              Join thousands of managers competing across DPC regions, ESL events, and international tournaments.
              Free forever.
            </p>
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                id="bottom-dashboard-cta"
                className="inline-flex items-center gap-3 rounded-2xl bg-linear-to-r from-amber-500 to-orange-600 px-10 py-5 text-xl font-black text-white shadow-2xl shadow-orange-500/25 transition-all hover:-translate-y-1 hover:shadow-orange-500/40"
              >
                Go to Dashboard
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </Link>
            ) : (
              <Link
                href="/signup"
                id="bottom-signup-cta"
                className="inline-flex items-center gap-3 rounded-2xl bg-linear-to-r from-amber-500 to-orange-600 px-10 py-5 text-xl font-black text-white shadow-2xl shadow-orange-500/25 transition-all hover:-translate-y-1 hover:shadow-orange-500/40"
              >
                Start Playing &mdash; It&apos;s Free
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </Link>
            )}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-slate-950/90 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-slate-500 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-900 ring-1 ring-amber-500/30">
              <BrandLogo className="h-6 w-6" />
            </div>
            <span className="font-semibold text-slate-400">Fantasy Dota 2</span>
            <span className="text-slate-700">&middot;</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/help"    className="transition-colors hover:text-amber-400">Help</Link>
            <Link href="/rules"   className="transition-colors hover:text-amber-400">Rules</Link>
            <Link href="/privacy" className="transition-colors hover:text-amber-400">Privacy</Link>
            <Link href="/terms"   className="transition-colors hover:text-amber-400">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

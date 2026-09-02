import Link from 'next/link';

const premiumFeatures = [
  {
    icon: '📊',
    title: 'Advanced Player Analytics',
    description: 'Deep-dive stats including role-adjusted performance scores, consistency ratings, volatility index, and head-to-head matchup analysis across every eligible tournament.',
    badge: 'Premium',
  },
  {
    icon: '🎯',
    title: 'Points Projections Engine',
    description: 'AI-powered expected fantasy points for each upcoming gameweek based on fixture difficulty, recent form, role, and historical performance patterns.',
    badge: 'Premium',
  },
  {
    icon: '🔄',
    title: 'Transfer Recommendations',
    description: 'Ranked transfer candidates ranked by value, form trajectory, and upcoming schedule. Identifies differentials, price risers, and captaincy picks before anyone else.',
    badge: 'Premium',
  },
  {
    icon: '🏆',
    title: 'Squad Optimiser',
    description: 'Automatically suggests the optimal 8-player squad within your budget, accounting for position requirements, team limits, and projected scores for the next gameweek.',
    badge: 'Premium',
  },
  {
    icon: '📈',
    title: 'Price Movement Alerts',
    description: 'Real-time notifications when tracked players are predicted to rise or fall based on ownership trends, transfer activity, and recent performance data.',
    badge: 'Premium',
  },
  {
    icon: '🤖',
    title: 'AI Fantasy Assistant',
    description: 'Ask natural language questions like "Who should I captain this week?" and get data-backed answers drawn directly from live match and ownership data.',
    badge: 'Coming Soon',
  },
];

const comparisonRows = [
  { feature: 'Squad building & transfers', free: true, premium: true },
  { feature: 'Classic & H2H leagues', free: true, premium: true },
  { feature: 'Global leaderboard', free: true, premium: true },
  { feature: 'Basic player stats', free: true, premium: true },
  { feature: 'Notifications (deadline, price, rank)', free: true, premium: true },
  { feature: 'Advanced player analytics', free: false, premium: true },
  { feature: 'Points projections', free: false, premium: true },
  { feature: 'Transfer recommendations', free: false, premium: true },
  { feature: 'Squad optimiser', free: false, premium: true },
  { feature: 'Price movement alerts', free: false, premium: true },
  { feature: 'AI Fantasy Assistant', free: false, premium: true },
];

export const metadata = {
  title: 'Premium | Fantasy Dota 2',
  description: 'Unlock advanced analytics, projections, and AI-powered insights to dominate your Fantasy Dota 2 leagues.',
};

export default function PremiumPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-700 bg-linear-to-br from-slate-900 via-slate-800 to-amber-950/30 py-20 px-4">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 uppercase tracking-wider">
            ⚡ Fantasy Dota 2 Premium
          </div>
          <h1 className="text-5xl font-extrabold text-white mb-4 leading-tight">
            Gain the Edge.<br />
            <span className="bg-linear-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Dominate Your Leagues.
            </span>
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Premium unlocks AI-powered projections, transfer recommendations, and deep player analytics so you always make the right move before the deadline.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              id="premium-join-waitlist"
              className="px-8 py-3 bg-linear-to-r from-amber-500 to-orange-600 text-white font-bold rounded-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all text-lg"
            >
              Join the Waitlist
            </button>
            <Link
              href="/dashboard"
              className="px-8 py-3 border border-slate-600 text-slate-300 font-semibold rounded-lg hover:border-slate-400 hover:text-white transition-all text-lg"
            >
              Continue with Free
            </Link>
          </div>
          <p className="text-slate-500 text-sm mt-4">Premium is coming soon. Core fantasy gameplay is always free.</p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-white text-center mb-2">What You Get with Premium</h2>
        <p className="text-slate-400 text-center mb-12">Data-driven tools that give serious managers a decisive edge.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {premiumFeatures.map((feature) => (
            <div
              key={feature.title}
              className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-amber-500/40 hover:bg-slate-800/80 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl">{feature.icon}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  feature.badge === 'Premium'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                }`}>
                  {feature.badge}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">
                {feature.title}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="max-w-3xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Free vs. Premium</h2>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="grid grid-cols-3 bg-slate-800 border-b border-slate-700 px-6 py-4 text-sm font-semibold text-slate-300">
            <span>Feature</span>
            <span className="text-center">Free</span>
            <span className="text-center text-amber-400">Premium</span>
          </div>
          {comparisonRows.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-3 px-6 py-3 text-sm border-b border-slate-700/50 last:border-0 ${
                i % 2 === 0 ? 'bg-slate-800/20' : ''
              }`}
            >
              <span className="text-slate-300">{row.feature}</span>
              <span className="text-center">
                {row.free
                  ? <span className="text-green-400 font-bold">✓</span>
                  : <span className="text-slate-600">—</span>}
              </span>
              <span className="text-center">
                {row.premium
                  ? <span className="text-amber-400 font-bold">✓</span>
                  : <span className="text-slate-600">—</span>}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA footer */}
      <section className="border-t border-slate-700 bg-slate-800/30 py-12 px-4 text-center">
        <h3 className="text-2xl font-bold text-white mb-2">Ready when you are</h3>
        <p className="text-slate-400 mb-6">Premium is in development. Be the first to know when it launches.</p>
        <button
          id="premium-footer-waitlist"
          className="px-8 py-3 bg-linear-to-r from-amber-500 to-orange-600 text-white font-bold rounded-lg hover:shadow-lg hover:shadow-orange-500/20 transition-all"
        >
          Join the Waitlist
        </button>
      </section>
    </div>
  );
}

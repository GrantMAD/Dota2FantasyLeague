'use client';

const TESTIMONIALS = [
  {
    quote: "I've tried other fantasy esports platforms — this one actually feels like it was built by Dota players.",
    name: 'Aleksander M.',
    tag: 'Manager since Season 1',
    pts: '2,841 pts',
    rank: '#4 Global',
    initials: 'AM',
    color: 'from-amber-600 to-orange-700',
  },
  {
    quote: 'The live scoring is addictive. Watching my captain pop off in a major series and seeing the points tick up in real time is incredible.',
    name: 'Sarah K.',
    tag: 'ESL Follower',
    pts: '3,102 pts',
    rank: '#1 League',
    initials: 'SK',
    color: 'from-cyan-600 to-teal-700',
  },
  {
    quote: 'The transfer market strategy is surprisingly deep. Got completely outplayed by someone who picked up a rising support player early.',
    name: 'Dom T.',
    tag: 'Competitive Manager',
    pts: '1,978 pts',
    rank: 'Top 5%',
    initials: 'DT',
    color: 'from-violet-600 to-purple-700',
  },
];

export function TestimonialsStrip() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {TESTIMONIALS.map((t) => (
        <div
          key={t.name}
          className="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-slate-600/60 hover:bg-slate-900/80"
        >
          {/* Quote mark */}
          <div className="mb-4 text-4xl font-black leading-none text-slate-700 group-hover:text-slate-600 transition-colors">
            &quot;
          </div>

          <p className="mb-6 text-sm leading-relaxed text-slate-300">{t.quote}</p>

          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br ${t.color} text-xs font-bold text-white`}>
              {t.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{t.name}</p>
              <p className="text-xs text-slate-500">{t.tag}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-amber-400">{t.pts}</p>
              <p className="text-[10px] text-slate-500">{t.rank}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

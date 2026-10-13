'use client';

const TEAMS = [
  'Team Spirit', 'Tundra Esports', 'OG', 'Gaimin Gladiators', 'Entity',
  'Team Secret', 'Virtus.pro', 'BetBoom Team', 'Natus Vincere', 'Shopify Rebellion',
  '9Pandas', 'Team Liquid', 'nouns', 'Hokori', 'beastcoast',
  'Quest Esports', 'Aurora', 'Xtreme Gaming', 'Azure Ray', 'PSG.LGD',
  'RNG', 'Team Falcons', 'BOOM Esports', 'Talon Esports',
];

const DOUBLED = [...TEAMS, ...TEAMS];

export function TeamMarquee() {
  return (
    <div className="relative w-full overflow-hidden border-y border-slate-800/60 bg-slate-950/40 py-4 backdrop-blur-sm">
      {/* Fade edges */}
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-[#05080f] to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-[#05080f] to-transparent" />

      <div className="landing-marquee flex w-max animate-[marquee_40s_linear_infinite] items-center gap-8 whitespace-nowrap">
        {DOUBLED.map((team, i) => (
          <span
            key={`${team}-${i}`}
            className="flex items-center gap-3 text-sm font-semibold text-slate-400 transition-colors hover:text-amber-400"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500/60" />
            {team}
          </span>
        ))}
      </div>
    </div>
  );
}

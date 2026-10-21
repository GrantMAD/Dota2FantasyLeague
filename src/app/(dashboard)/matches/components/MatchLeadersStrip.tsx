'use client';

import Link from 'next/link';
import { Trophy, Flame, Coins, Crosshair } from 'lucide-react';

interface LeaderStat {
  playerId: number;
  playerName: string;
  heroName?: string | null;
  role: string;
  value: number;
  formattedValue: string;
}

interface MatchLeadersStripProps {
  fantasyMVP: LeaderStat | null;
  highestDamage: LeaderStat | null;
  highestGPM: LeaderStat | null;
  highestKills: LeaderStat | null;
}

export function MatchLeadersStrip({
  fantasyMVP,
  highestDamage,
  highestGPM,
  highestKills,
}: MatchLeadersStripProps) {
  if (!fantasyMVP && !highestDamage && !highestGPM && !highestKills) return null;

  const cards = [
    {
      title: 'Fantasy MVP',
      icon: Trophy,
      data: fantasyMVP,
      textColor: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      badge: 'TOP FANTASY',
    },
    {
      title: 'Top Damage',
      icon: Flame,
      data: highestDamage,
      textColor: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      badge: 'HERO DAMAGE',
    },
    {
      title: 'Top Economy',
      icon: Coins,
      data: highestGPM,
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      badge: 'GPM',
    },
    {
      title: 'Kill Leader',
      icon: Crosshair,
      data: highestKills,
      textColor: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
      badge: 'KILLS',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => {
        if (!c.data) return null;
        const IconComponent = c.icon;
        return (
          <div
            key={c.title}
            className={`relative isolate overflow-hidden rounded-2xl border ${c.borderColor} bg-[var(--surface)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}
          >
            <div className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full ${c.bgColor} blur-2xl`} />
            <div className="relative mb-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <IconComponent className={`w-3.5 h-3.5 ${c.textColor}`} />
                {c.title}
              </span>
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${c.bgColor} ${c.textColor} border ${c.borderColor}`}>
                {c.badge}
              </span>
            </div>

            <div className="relative">
              <Link
                href={`/players/${c.data.playerId}`}
                className="line-clamp-1 text-sm font-bold text-[var(--text-primary)] transition-colors hover:text-amber-500"
              >
                {c.data.playerName}
              </Link>
              <p className="line-clamp-1 text-xs text-[var(--text-muted)]">
                {c.data.heroName || c.data.role}
              </p>
            </div>

            <div className="relative mt-3 flex items-baseline justify-between border-t border-[var(--border)] pt-2">
              <span className="text-[11px] text-[var(--text-muted)]">{c.title === 'Fantasy MVP' ? 'Fantasy score' : 'Match record'}</span>
              <span className={`font-mono text-base font-extrabold ${c.textColor}`}>
                {c.data.formattedValue}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
            className={`rounded-2xl border ${c.borderColor} ${c.bgColor} p-4 flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <IconComponent className={`w-3.5 h-3.5 ${c.textColor}`} />
                {c.title}
              </span>
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${c.bgColor} ${c.textColor} border ${c.borderColor}`}>
                {c.badge}
              </span>
            </div>

            <div>
              <Link
                href={`/players/${c.data.playerId}`}
                className="font-bold text-sm text-white hover:text-amber-400 transition-colors line-clamp-1"
              >
                {c.data.playerName}
              </Link>
              <p className="text-xs text-slate-400 line-clamp-1">
                {c.data.heroName || c.data.role}
              </p>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-baseline justify-between">
              <span className="text-[11px] text-slate-500">Record</span>
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

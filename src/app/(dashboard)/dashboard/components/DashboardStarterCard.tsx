'use client';

import type { DashboardStarter } from '@/types/fantasy';

const ROLE_COLOURS: Record<string, { bg: string; text: string; border: string; glow: string; gradient: string }> = {
  carry:        { bg: 'rgba(251,113,133,0.10)', text: '#fb7185', border: 'rgba(251,113,133,0.30)', glow: 'rgba(251,113,133,0.20)', gradient: 'linear-gradient(180deg, rgba(251,113,133,0.18) 0%, transparent 60%)' },
  mid:          { bg: 'rgba(251,191,36,0.10)',  text: '#f59e0b', border: 'rgba(251,191,36,0.30)',  glow: 'rgba(251,191,36,0.20)',  gradient: 'linear-gradient(180deg, rgba(251,191,36,0.18) 0%, transparent 60%)'  },
  offlane:      { bg: 'rgba(52,211,153,0.10)',  text: '#34d399', border: 'rgba(52,211,153,0.30)',  glow: 'rgba(52,211,153,0.20)',  gradient: 'linear-gradient(180deg, rgba(52,211,153,0.18) 0%, transparent 60%)'  },
  support:      { bg: 'rgba(96,165,250,0.10)',  text: '#60a5fa', border: 'rgba(96,165,250,0.30)',  glow: 'rgba(96,165,250,0.20)',  gradient: 'linear-gradient(180deg, rgba(96,165,250,0.18) 0%, transparent 60%)'  },
  hard_support: { bg: 'rgba(167,139,250,0.10)', text: '#a78bfa', border: 'rgba(167,139,250,0.30)', glow: 'rgba(167,139,250,0.20)', gradient: 'linear-gradient(180deg, rgba(167,139,250,0.18) 0%, transparent 60%)' },
};

const ROLE_LABELS: Record<string, string> = {
  carry: 'Carry',
  mid: 'Mid',
  offlane: 'Offlane',
  support: 'Support',
  hard_support: 'Hard Sup',
};

interface DashboardStarterCardProps {
  player: DashboardStarter;
  onOpenPlayer: (player: DashboardStarter) => void;
}

export function DashboardStarterCard({ player, onOpenPlayer }: DashboardStarterCardProps) {
  const displayName = player.in_game_name || player.name;
  const initials = displayName.substring(0, 2).toUpperCase();
  const role = ROLE_COLOURS[player.slot] ?? {
    bg: 'rgba(148,163,184,0.10)',
    text: '#94a3b8',
    border: 'rgba(148,163,184,0.30)',
    glow: 'rgba(148,163,184,0.15)',
    gradient: 'linear-gradient(180deg, rgba(148,163,184,0.15) 0%, transparent 60%)',
  };

  // Form trend
  const formTrend: 'up' | 'down' | 'flat' | 'none' =
    player.gw_points != null && player.prev_gw_points != null
      ? player.gw_points > player.prev_gw_points
        ? 'up'
        : player.gw_points < player.prev_gw_points
        ? 'down'
        : 'flat'
      : 'none';

  const formColour = formTrend === 'up' ? '#34d399' : formTrend === 'down' ? '#fb7185' : '#64748b';
  const formArrow = formTrend === 'up' ? '▲' : formTrend === 'down' ? '▼' : formTrend === 'flat' ? '▬' : null;

  return (
    <button
      type="button"
      onClick={() => onOpenPlayer(player)}
      aria-label={`View ${displayName} player details`}
      className="relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl text-left transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      style={{
        background: 'var(--surface-raised)',
        border: `1px solid ${role.border}`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 20px 4px ${role.glow}, 0 8px 24px rgba(0,0,0,0.22)`;
        (e.currentTarget as HTMLButtonElement).style.borderColor = role.text;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLButtonElement).style.borderColor = role.border;
      }}
    >
      {/* Top role colour bar */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${role.text}, transparent)` }} />

      {/* Captain / Vice-Captain badge */}
      {player.is_captain && (
        <span
          aria-label="Captain (2x Points)"
          className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-md"
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: '#ffffff',
            boxShadow: '0 2px 10px rgba(245, 158, 11, 0.45)',
          }}
        >
          <span>C</span>
          <span className="text-[9px] font-bold opacity-90">2×</span>
        </span>
      )}

      {player.is_vice_captain && !player.is_captain && (
        <span
          aria-label="Vice-captain"
          className="absolute right-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black shadow-md"
          style={{
            background: 'linear-gradient(135deg, #06b6d4, #0284c7)',
            color: '#ffffff',
            boxShadow: '0 2px 8px rgba(6, 182, 212, 0.35)',
          }}
        >
          V
        </span>
      )}

      {/* Avatar section — hero image with vignette overlay */}
      <div
        className="relative mx-3 mt-3 flex h-24 w-[calc(100%-1.5rem)] items-center justify-center overflow-hidden rounded-xl"
        style={{ background: role.gradient + ', ' + role.bg, border: `1px solid ${role.border}` }}
      >
        {player.profile_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.profile_image_url}
            alt=""
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
              event.currentTarget.nextElementSibling?.removeAttribute('hidden');
            }}
          />
        ) : null}
        <span
          hidden={!!player.profile_image_url}
          className="text-2xl font-black tracking-tight"
          style={{ color: role.text }}
        >
          {initials}
        </span>
      </div>

      {/* Info section */}
      <div className="flex flex-col gap-2 p-3 pt-2.5">
        {/* Name + form trend */}
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <span
              className="block truncate text-[13px] font-bold leading-snug"
              style={{ color: 'var(--text-primary)' }}
              title={displayName}
            >
              {displayName}
            </span>
            <span className="mt-0.5 block truncate text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
              {player.team_name || 'Free Agent'}
            </span>
          </div>
          {formArrow && (
            <span className="mt-0.5 shrink-0 text-[11px] font-bold" style={{ color: formColour }}>
              {formArrow}
            </span>
          )}
        </div>

        {/* Role pill */}
        <span
          className="inline-block self-start rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-widest leading-none"
          style={{ background: role.bg, border: `1px solid ${role.border}`, color: role.text }}
        >
          {ROLE_LABELS[player.slot] ?? player.slot.replace('_', ' ')}
        </span>

        {/* Stats block */}
        <div
          className="flex flex-col rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          {/* GW Points row */}
          <div
            className="flex items-center justify-between gap-2 px-2.5 py-2"
            style={{ background: 'var(--surface-muted)' }}
          >
            <span className="text-[9px] font-medium uppercase tracking-wide leading-none shrink-0" style={{ color: 'var(--text-muted)' }}>GW Pts</span>
            {player.gw_points != null ? (
              <span className="font-mono text-sm font-black leading-none" style={{ color: 'var(--accent-primary)' }}>
                {player.is_captain ? (player.gw_points * 2).toFixed(1) : player.gw_points.toFixed(1)}
                {player.is_captain && (
                  <span className="ml-0.5 text-[9px] font-bold opacity-60">×2</span>
                )}
              </span>
            ) : (
              <span className="font-mono text-sm font-semibold leading-none opacity-40" style={{ color: 'var(--text-muted)' }}>—</span>
            )}
          </div>

          {/* Divider */}
          <div className="h-px w-full" style={{ background: 'var(--border)' }} />

          {/* Price row */}
          <div
            className="flex items-center justify-between gap-2 px-2.5 py-2"
            style={{ background: 'var(--surface-muted)' }}
          >
            <span className="text-[9px] font-medium uppercase tracking-wide leading-none shrink-0" style={{ color: 'var(--text-muted)' }}>Price</span>
            <span className="font-mono text-sm font-bold leading-none" style={{ color: 'var(--success)' }}>
              ${Number(player.current_price || 0).toFixed(1)}M
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

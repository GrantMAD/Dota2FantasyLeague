'use client';

import type { DashboardStarter } from '@/types/fantasy';

const ROLE_COLOURS: Record<string, { bg: string; text: string; border: string }> = {
  carry: { bg: 'rgba(251,113,133,0.12)', text: '#fb7185', border: 'rgba(251,113,133,0.28)' },
  mid: { bg: 'rgba(251,191,36,0.12)', text: '#f59e0b', border: 'rgba(251,191,36,0.28)' },
  offlane: { bg: 'rgba(52,211,153,0.12)', text: '#34d399', border: 'rgba(52,211,153,0.28)' },
  support: { bg: 'rgba(96,165,250,0.12)', text: '#60a5fa', border: 'rgba(96,165,250,0.28)' },
  hard_support: { bg: 'rgba(167,139,250,0.12)', text: '#a78bfa', border: 'rgba(167,139,250,0.28)' },
};

interface DashboardStarterCardProps {
  player: DashboardStarter;
  onOpenPlayer: (player: DashboardStarter) => void;
}

export function DashboardStarterCard({ player, onOpenPlayer }: DashboardStarterCardProps) {
  const displayName = player.in_game_name || player.name;
  const initials = displayName.substring(0, 2).toUpperCase();
  const role = ROLE_COLOURS[player.slot] ?? {
    bg: 'rgba(148,163,184,0.12)',
    text: '#94a3b8',
    border: 'rgba(148,163,184,0.28)',
  };

  return (
    <button
      type="button"
      onClick={() => onOpenPlayer(player)}
      aria-label={`View ${displayName} player details`}
      className="relative flex w-40 shrink-0 cursor-pointer flex-col overflow-visible rounded-2xl text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 sm:w-auto sm:min-w-0"
      style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
    >
      <div className="h-0.75 w-full rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${role.text}, transparent)` }} />
      {player.is_captain && (
        <span aria-label="Captain" className="absolute -top-2 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black shadow-md"
          style={{ background: 'var(--accent-primary)', color: 'var(--background)' }}>
          C
        </span>
      )}
      {player.is_vice_captain && (
        <span aria-label="Vice-captain" className="absolute -top-2 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black shadow-md"
          style={{ background: 'var(--accent-secondary)', color: 'var(--background)' }}>
          V
        </span>
      )}

      <div className="flex min-h-40 flex-1 flex-col gap-2 p-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-black"
          style={{ background: role.bg, border: `1px solid ${role.border}`, color: role.text }}>
          {player.profile_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.profile_image_url}
              alt=""
              className="h-full w-full object-cover object-top"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
                event.currentTarget.nextElementSibling?.removeAttribute('hidden');
              }}
            />
          ) : null}
          <span hidden={!!player.profile_image_url}>{initials}</span>
        </div>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-bold leading-snug" style={{ color: 'var(--text-primary)' }} title={displayName}>
            {displayName}
          </span>
          <span className="mt-0.5 block truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {player.team_name || 'Free Agent'}
          </span>
        </span>
        <span className="mt-auto inline-block self-start rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide leading-none"
          style={{ background: role.bg, border: `1px solid ${role.border}`, color: role.text }}>
          {player.slot.replace('_', ' ')}
        </span>
      </div>

      <div className="mt-auto px-3 pb-3">
        <div className="rounded-xl px-2.5 py-2" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>GW Pts</span>
            {player.gw_points != null ? (
              <span className="font-mono text-sm font-black" style={{ color: 'var(--accent-primary)' }}>
                {player.is_captain ? (player.gw_points * 2).toFixed(2) : player.gw_points.toFixed(2)}
                {player.is_captain && <span className="ml-0.5 text-[9px] font-bold opacity-60">&times;2</span>}
              </span>
            ) : (
              <span className="font-mono text-sm font-semibold opacity-50" style={{ color: 'var(--text-muted)' }}>—</span>
            )}
          </div>
          <div className="mt-0.5 flex items-center justify-between">
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Price</span>
            <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--success)' }}>
              ${Number(player.current_price || 0).toFixed(1)}M
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

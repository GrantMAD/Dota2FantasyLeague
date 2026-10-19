import Link from 'next/link';
import { ArrowLeftRight, ArrowRight, CalendarClock, Shield, Trophy, UserCheck } from 'lucide-react';

interface DashboardQuickActionsProps {
  activeSquadCount: number;
  bankBalance: number;
  freeTransfers: number;
  deadlineCountdown?: string;
  hasLeagues: boolean;
}

export function DashboardQuickActions({
  activeSquadCount,
  bankBalance,
  freeTransfers,
  deadlineCountdown = '',
  hasLeagues,
}: DashboardQuickActionsProps) {
  const deadlinePassed = deadlineCountdown === 'Deadline passed';
  const actions = [
    {
      title: activeSquadCount > 0 ? 'Set your lineup' : 'Build your first squad',
      description: activeSquadCount > 0
        ? deadlinePassed
          ? 'The deadline has passed. Review your current lineup.'
          : `Choose your starters and captain${deadlineCountdown ? ` before ${deadlineCountdown}` : ' before the gameweek deadline'}.`
        : `Draft your squad and start your season with ${bankBalance.toFixed(1)}M available.`,
      href: activeSquadCount > 0 ? '/lineups' : '/squads',
      icon: activeSquadCount > 0 ? UserCheck : Shield,
    },
    {
      title: freeTransfers > 0
        ? `Use ${freeTransfers} free transfer${freeTransfers === 1 ? '' : 's'}`
        : 'Scout the transfer market',
      description: freeTransfers > 0
        ? 'Improve your squad without using a transfer chip.'
        : 'Find players who can strengthen your next lineup.',
      href: '/transfers',
      icon: ArrowLeftRight,
    },
    {
      title: hasLeagues ? 'Check your league standings' : 'Join a league',
      description: hasLeagues
        ? 'See how you compare with your rivals.'
        : 'Compete with friends or find a public league.',
      href: '/leagues',
      icon: Trophy,
    },
    {
      title: deadlinePassed ? 'Review the gameweek' : 'Check the next deadline',
      description: deadlinePassed
        ? 'Review the schedule and completed fixtures.'
        : 'See upcoming fixtures and gameweek timing.',
      href: '/gameweeks',
      icon: CalendarClock,
    },
  ];

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Your Next Moves</h2>
      <div data-guide="dashboard-actions" data-tour="dashboard-actions" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              href={action.href}
              className="group rounded-2xl p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="mb-3 flex items-start justify-between">
                <div
                  className="flex items-center justify-center rounded-xl p-2.5 transition-transform group-hover:scale-105"
                  style={{
                    background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)',
                  }}
                >
                  <Icon aria-hidden="true" className="h-5 w-5" style={{ color: 'var(--accent-primary)' }} />
                </div>
                <ArrowRight aria-hidden="true" className="h-4 w-4 transition-all group-hover:translate-x-1" style={{ color: 'var(--text-muted)' }} />
              </div>
              <h3 className="mb-1 text-base font-bold transition-colors" style={{ color: 'var(--text-primary)' }}>
                {action.title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {action.description}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

import Link from 'next/link';
import { ArrowLeftRight, ArrowRight, CalendarClock, Shield, Trophy, UserCheck } from 'lucide-react';

interface DashboardQuickActionsProps {
  activeSquadCount: number;
  bankBalance: number;
  freeTransfers: number;
  deadlineCountdown: string;
  hasLeagues: boolean;
}

export function DashboardQuickActions({
  activeSquadCount,
  bankBalance,
  freeTransfers,
  deadlineCountdown,
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
      <h2 className="mb-6 text-2xl font-bold text-white">Your Next Moves</h2>
      <div data-guide="dashboard-actions" data-tour="dashboard-actions" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              href={action.href}
              className="group rounded-lg border border-slate-700 bg-slate-800/50 p-5 transition-all hover:border-amber-500/50 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div className="mb-3 flex items-start justify-between">
                <Icon aria-hidden="true" className="h-7 w-7 text-amber-400 transition-transform group-hover:scale-110" />
                <ArrowRight aria-hidden="true" className="h-4 w-4 text-slate-500 transition-all group-hover:translate-x-1 group-hover:text-amber-300" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white group-hover:text-amber-300">{action.title}</h3>
              <p className="text-sm leading-5 text-slate-400">{action.description}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

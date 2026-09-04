'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

type GuideContent = { title: string; steps: string[] };
type TargetRect = { top: number; left: number; width: number; height: number; stepIndex: number };

const guideContent: Record<string, GuideContent> = {
  '/': { title: 'Welcome to Fantasy Dota 2', steps: ['Create an account or sign in', 'Build an eight-player fantasy squad within the budget', 'Set your lineup and compete in leagues'] },
  '/login': { title: 'Sign In', steps: ['Enter the email used for your account', 'Enter your password and use the visibility button if needed', 'Choose Sign In to open the dashboard'] },
  '/signup': { title: 'Create Account', steps: ['Choose a unique username', 'Enter and confirm a password of at least eight characters', 'Confirm your email if verification is enabled'] },
  '/forgot-password': { title: 'Forgot Password', steps: ['Enter the email linked to your account', 'Submit the request', 'Follow the reset link sent to your inbox'] },
  '/dashboard': { title: 'Dashboard', steps: ['Review your summary statistics', 'Check the active gameweek and deadline', 'Use Quick Actions to manage your team'] },
  '/squads': { title: 'Squad', steps: ['Review your five starters and three bench players', 'Check roles, prices, and captain markers', 'Use lineup or transfer actions to make changes'] },
  '/lineups': { title: 'Lineups', steps: ['Choose one player for each starting role', 'Set your captain and vice-captain', 'Place remaining players on the bench and save'] },
  '/transfers': { title: 'Transfers', steps: ['Search or filter the player market', 'Review price, form, ownership, and availability', 'Select a sale and purchase, then confirm the transfer'] },
  '/players': { title: 'Players', steps: ['Search by player name or in-game name', 'Filter by role or team', 'Open a player to view their detailed profile'] },
  '/players/1': { title: 'Player Details', steps: ['Review the player identity, team, and role', 'Inspect price, form, and performance statistics', 'Read the recent match history and fantasy points'] },
  '/leagues': { title: 'Leagues', steps: ['Browse your current league memberships', 'Create a league or join using an invite code', 'Open a league to review standings or fixtures'] },
  '/leaderboard': { title: 'Leaderboard', steps: ['Review the global ranking table', 'Use the country filter when available', 'Check rank changes and gameweek points'] },
  '/gameweeks': { title: 'Gameweeks', steps: ['Find the active gameweek', 'Check its lineup deadline', 'Review completed gameweek results'] },
  '/matches': { title: 'Matches', steps: ['Review upcoming and completed matches', 'Check teams, status, date, and duration', 'Open a match for its detailed information'] },
  '/matches/1': { title: 'Match Details', steps: ['Review the tournament, date, and gameweek', 'Compare both teams and the match result', 'Check duration and detailed match information'] },
  '/tournaments': { title: 'Tournaments', steps: ['Review tournament tier and status', 'Open a tournament to see its schedule', 'Select a match for additional details'] },
  '/tournaments/1': { title: 'Tournament Details', steps: ['Review the tournament status and dates', 'Browse the associated matches', 'Open a match for additional details'] },
  '/analytics': { title: 'Analytics', steps: ['Read the headline metrics', 'Compare engagement and growth indicators', 'Use premium tools when your account has access'] },
  '/profile': { title: 'Profile', steps: ['Review your display name and username', 'Check your fantasy career statistics', 'Open Settings to edit profile details'] },
  '/account': { title: 'Account', steps: ['Review or update your username', 'Set country and timezone', 'Use password reset when you need new credentials'] },
  '/settings': { title: 'Settings', steps: ['Update profile information', 'Choose light or dark mode', 'Manage email and push notification preferences'] },
  '/notifications': { title: 'Notifications', steps: ['Read unread notifications', 'Mark individual notifications as read', 'Use Mark all as read to clear the list'] },
  '/premium': { title: 'Premium', steps: ['Review the available features', 'Compare free and premium access', 'Choose an upgrade or waitlist action when available'] },
  '/help': { title: 'Help Center', steps: ['Browse the frequently asked questions', 'Read the role eligibility guidance', 'Use the support option for unresolved issues'] },
  '/rules': { title: 'Rules', steps: ['Understand squad and role requirements', 'Review how fantasy points are calculated', 'Check transfer, deadline, and chip rules'] },
};

const targetSelectors: Record<string, string[]> = {
  '/': ['header', 'main h1', 'main > div > div:last-child'],
  '/login': ['form input[type="email"]', 'form input[type="password"]', 'form button[type="submit"]'],
  '/signup': ['form input[name="username"]', 'form input[type="email"]', 'form button[type="submit"]'],
  '/forgot-password': ['main form input', 'main form button'],
  '/dashboard': ['[data-guide="dashboard-stats"]', '[data-guide="dashboard-gameweek"]', '[data-guide="dashboard-actions"]'],
};

function getSelectors(pathname: string, content: GuideContent) {
  return targetSelectors[pathname] ?? content.steps.map((_, index) => index === 0 ? 'main h1' : index === 1 ? 'main section, main [class*="grid"]' : 'main a, main button');
}

export function PageGuideOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const content = guideContent[pathname];
  const isOpen = searchParams.get('guide') === '1';
  const [stepIndex, setStepIndex] = useState(0);
  const [target, setTarget] = useState<TargetRect | null>(null);

  const closeGuide = () => {
    setStepIndex(0);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('guide');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (!isOpen || !content) return;
    const selectors = getSelectors(pathname, content);
    let settled = false;
    const measureTarget = () => {
      if (!settled) return;
      const element = document.querySelector(selectors[stepIndex]) ?? document.querySelector('main');
      if (!element) return;
      const rect = element.getBoundingClientRect();
      setTarget({ top: rect.top, left: rect.left, width: rect.width, height: rect.height, stepIndex });
    };
    const element = document.querySelector(selectors[stepIndex]) ?? document.querySelector('main');
    element?.scrollIntoView({ behavior: 'auto', block: 'center' });
    const settleTimer = window.setTimeout(() => {
      settled = true;
      measureTarget();
    }, 150);
    const observer = element ? new ResizeObserver(measureTarget) : null;
    if (element && observer) observer.observe(element);
    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget, true);
    return () => {
      window.clearTimeout(settleTimer);
      observer?.disconnect();
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [isOpen, pathname, content, stepIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setStepIndex(0);
        const params = new URLSearchParams(searchParams.toString());
        params.delete('guide');
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, router, searchParams, pathname]);

  if (!isOpen || !content) return null;

  const isLastStep = stepIndex === content.steps.length - 1;
  const activeTarget = target?.stepIndex === stepIndex ? target : null;
  const tooltipTop = activeTarget ? activeTarget.top + activeTarget.height + 18 : '50%';
  const tooltipLeft = activeTarget ? Math.max(16, activeTarget.left + activeTarget.width / 2 - 190) : 16;

  return (
    <div className="fixed inset-0 z-100" role="dialog" aria-modal="true" aria-labelledby="page-guide-title">
      <div className="absolute inset-0 bg-slate-950/65" />
      {activeTarget && <div className="fixed z-101 box-border rounded-lg border-2 border-cyan-300 shadow-[0_0_0_9999px_rgba(2,6,23,0.68),0_0_24px_rgba(34,211,238,0.55)]" style={{ top: activeTarget.top - 6, left: activeTarget.left - 6, width: activeTarget.width + 12, height: activeTarget.height + 12 }} />}
      <div className={`fixed z-102 w-[min(380px,calc(100vw-32px))] rounded-xl border border-cyan-400/50 bg-slate-900 p-5 shadow-2xl ${activeTarget ? '' : '-translate-y-1/2'}`} style={{ top: tooltipTop, left: tooltipLeft }}>
        <div className="mb-3 flex items-start justify-between gap-4">
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">{content.title} guide</p><h2 id="page-guide-title" className="text-lg font-bold text-white">Step {stepIndex + 1} of {content.steps.length}</h2></div>
          <button type="button" onClick={closeGuide} aria-label="Close page guide" title="Close page guide" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm leading-6 text-slate-300">{content.steps[stepIndex]}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={() => setStepIndex((current) => Math.max(0, current - 1))} disabled={stepIndex === 0} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:invisible"><ArrowLeft className="h-4 w-4" />Back</button>
          <button type="button" onClick={() => isLastStep ? closeGuide() : setStepIndex((current) => current + 1)} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500">{isLastStep ? 'Finish' : 'Next'}{!isLastStep && <ArrowRight className="h-4 w-4" />}</button>
        </div>
      </div>
    </div>
  );
}

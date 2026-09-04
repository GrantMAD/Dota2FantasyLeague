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
  '/squads': { title: 'Squad', steps: ['Review your five starters deployed across core roles on the fantasy pitch', 'Check player pricing, team badges, roles, and your Captain (2.0x points) or Vice-Captain markers', 'Your three bench substitutes step in automatically if a starter does not play in an eligible match', 'Use Make Transfers to trade players, or Edit Lineup to adjust starters and captaincy'] },
  '/lineups': {
    title: 'Lineups',
    steps: [
      'Assign your 5 starters across each role (Carry, Mid, Offlane, Supports)',
      'Designate a Captain (earns double points) and Vice-Captain from your active starters',
      'Fill your 3 bench substitute slots to step in if any starter misses their match',
      'Activate special seasonal chips like Triple Captain (3x points) or Bench Boost',
      'Save your lineup before the active gameweek deadline locks all changes',
    ],
  },
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
  // Public pages
  '/': [
    'header nav a[href="/signup"], header nav a[href="/login"], header nav .flex.items-center.gap-4',
    'main .grid.grid-cols-1.md\\:grid-cols-3 > div:first-child, main .grid > div:first-child',
    'main .grid.grid-cols-1.md\\:grid-cols-3 > div:last-child, main .grid > div:last-child',
  ],
  '/login': [
    'form input[type="email"]',
    'form input[type="password"], form input[name="password"]',
    'form button[type="submit"]',
  ],
  '/signup': [
    'form input[name="username"]',
    'form input[name="password"], form input[type="password"]',
    'form button[type="submit"]',
  ],
  '/forgot-password': [
    'form input[type="email"], form input[name="email"], input#email',
    'form button[type="submit"]',
    '.w-full.max-w-md h1, form',
  ],
  // Dashboard
  '/dashboard': [
    '[data-guide="dashboard-stats"]',
    '[data-guide="dashboard-gameweek"]',
    '[data-guide="dashboard-actions"]',
  ],
  // Squad management
  '/squads': [
    '[data-guide="squad-pitch"], main .border-emerald-800\\/30, main .bg-linear-to-b, .bg-linear-to-b',
    '[data-guide="squad-first-player"], main .bg-linear-to-b .relative.w-32:first-child, main .flex.flex-wrap > div:first-child',
    '[data-guide="squad-bench"], main .rounded-2xl:last-of-type, main .bg-slate-800\\/40',
    '[data-guide="squad-actions"], main a[href="/lineups"], main .flex.gap-4',
  ],
  '/lineups': [
    '[data-guide="lineup-starters"], main select',
    '[data-guide="lineup-captain-controls"], [data-guide="lineup-first-slot"]',
    '[data-guide="lineup-bench"]',
    '[data-guide="lineup-chips"], .lineup-chip-card',
    '[data-guide="lineup-save-btn"], main button.bg-amber-600',
  ],
  '/transfers': [
    'main input[placeholder*="Search"], main input[type="text"]',
    'main table thead tr, main table tbody tr:first-child',
    'main table tbody tr:first-child td:last-child, .wildcard-card',
  ],
  '/players': [
    'main input[placeholder*="Search"], main input[type="text"]',
    'main select',
    'main table tbody tr:first-child a, main table tbody tr:first-child',
  ],
  '/players/1': [
    'main .text-4xl.font-bold, main h1',
    'main .grid.grid-cols-2.md\\:grid-cols-4, main .grid-cols-2',
    'main table tbody tr:first-child',
  ],
  // Competition
  '/leagues': [
    'main .grid.grid-cols-1.gap-3.sm\\:grid-cols-2 > div:first-child, main .grid.sm\\:grid-cols-2 > div:first-child, main h1',
    'input[placeholder="League name"], main .space-y-6 > div:first-child',
    'main .border-t.pt-6, main h2',
  ],
  '/leaderboard': [
    'main table thead tr, main table tbody tr:first-child',
    'main select',
    'main table tbody tr:first-child',
  ],
  '/gameweeks': [
    'main .border-amber-500\\/50, main .rounded-xl:first-of-type',
    'main .border-amber-500\\/50 .font-mono, main .rounded-xl .font-mono',
    'main a[href*="/gameweeks/"], main .rounded-xl:last-of-type',
  ],
  '/matches': [
    'main .grid > a:first-child, main .grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3 > a:first-child',
    'main .grid > a:first-child .flex.items-center.justify-between, main .grid > a:first-child',
    'main .grid > a:first-child',
  ],
  '/matches/1': [
    'main .rounded-xl .mb-8, main h1',
    'main .rounded-xl .grid',
    'main .rounded-xl .grid > div:nth-child(2), main .rounded-xl p.border-t',
  ],
  '/tournaments': [
    'main .grid > a:first-child .flex.justify-between, main .grid > a:first-child',
    'main .grid > a:first-child',
    'main .grid > a:first-child .border-t',
  ],
  '/tournaments/1': [
    'main .rounded-lg.p-8, main h1',
    'main h2, main .space-y-4 > div:first-child',
    'main .space-y-4 > div:first-child, main .space-y-4',
  ],
  // Account & insights
  '/analytics': [
    '.grid.lg\\:grid-cols-4 > div:first-child, .grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4 > div:first-child',
    '.grid.lg\\:grid-cols-3 > div:first-child, .grid.grid-cols-1.lg\\:grid-cols-3 > div:first-child',
    '.grid.lg\\:grid-cols-3 > div:last-child, .grid.grid-cols-1.lg\\:grid-cols-3 > div:last-child',
  ],
  '/profile': [
    '.profile-card h1, main h1',
    '.profile-card .grid, main .grid.grid-cols-1.sm\\:grid-cols-3',
    'a[href="/settings"]',
  ],
  '/account': [
    '#account-username',
    '#account-country',
    'a[href="/forgot-password"], a[href*="password"]',
  ],
  '/settings': [
    'input[type="text"], input[value]',
    'main .grid.grid-cols-2, .grid.grid-cols-2',
    '.w-64 button:nth-child(2)',
  ],
  '/notifications': [
    'main .space-y-4 > div:first-child, .space-y-4 > div:first-child',
    'main .space-y-4 button[title="Mark as read"], main .space-y-4 > div:first-child button',
    'main .flex.justify-between button',
  ],
  '/premium': [
    'section .grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3 > div:first-child, .grid.lg\\:grid-cols-3 > div:first-child',
    '.max-w-3xl .rounded-xl, section:has(h2) .rounded-xl',
    '#premium-join-waitlist',
  ],
  '/help': [
    '.space-y-3 > div:first-child',
    '.space-y-6 .bg-slate-800\\/50.border:nth-child(2)',
    '.space-y-6 button, .space-y-6 .bg-slate-800\\/50.border:last-child',
  ],
  '/rules': [
    'section:first-of-type, .space-y-8 > section:first-child',
    'section:nth-of-type(2), .space-y-8 > section:nth-child(2)',
    'section:nth-of-type(3), .space-y-8 > section:nth-child(3)',
  ],
};

function findElement(selectorSpec: string): HTMLElement | null {
  const parts = selectorSpec.split(',').map((s) => s.trim());
  for (const part of parts) {
    if (!part) continue;
    try {
      const el = document.querySelector<HTMLElement>(part);
      if (el) return el;
    } catch {
      // Ignore selector syntax errors in complex selectors
    }
  }
  return null;
}

function getSelectors(pathname: string, content: GuideContent): string[] {
  return targetSelectors[pathname] ?? content.steps.map(() => 'h1');
}

export function PageGuideOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const content = guideContent[pathname];
  const isOpen = searchParams.get('guide') === '1';
  const [stepIndex, setStepIndex] = useState(0);
  const [target, setTarget] = useState<TargetRect | null>(null);
  const [isSettled, setIsSettled] = useState(false);

  const closeGuide = () => {
    setStepIndex(0);
    setTarget(null);
    setIsSettled(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('guide');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  // Immediately clear highlight and settle state on pathname or step change
  useEffect(() => {
    setTarget(null);
    setIsSettled(false);
  }, [pathname, stepIndex]);

  useEffect(() => {
    if (!isOpen || !content) {
      setTarget(null);
      setIsSettled(false);
      return;
    }

    const selectors = getSelectors(pathname, content);
    const selectorSpec = selectors[stepIndex] || 'h1';
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let settleTimer: number | null = null;
    let maxTimeout: number | null = null;

    const measureAndSet = (element: HTMLElement) => {
      if (cancelled) return;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      setTarget({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        stepIndex,
      });
      setIsSettled(true);
    };

    const scrollToElement = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const inView =
        rect.top >= 50 &&
        rect.top <= window.innerHeight - 150 &&
        rect.left >= 0 &&
        rect.right <= window.innerWidth;

      if (!inView) {
        const elDocTop = window.scrollY + rect.top;
        const targetY = Math.max(0, elDocTop - 80);
        window.scrollTo({ top: targetY, behavior: 'instant' });
      }
    };

    const startObserving = (element: HTMLElement) => {
      scrollToElement(element);

      measureAndSet(element);
      requestAnimationFrame(() => {
        if (cancelled) return;
        measureAndSet(element);
      });

      resizeObserver = new ResizeObserver(() => {
        if (!cancelled) measureAndSet(element);
      });
      resizeObserver.observe(element);
    };

    const tryFindAndObserve = () => {
      if (cancelled) return false;
      const element = findElement(selectorSpec);
      if (element) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          startObserving(element);
          return true;
        }
      }
      return false;
    };

    let pollInterval: number | null = null;

    // 1. Try finding immediately
    if (!tryFindAndObserve()) {
      // Poll every 60ms to catch fast asynchronous renders or client state changes
      pollInterval = window.setInterval(() => {
        if (tryFindAndObserve()) {
          if (pollInterval) window.clearInterval(pollInterval);
          mutationObserver?.disconnect();
        }
      }, 60);

      // 2. Also observe DOM changes
      mutationObserver = new MutationObserver(() => {
        if (tryFindAndObserve()) {
          if (pollInterval) window.clearInterval(pollInterval);
          mutationObserver?.disconnect();
        }
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true });

      // Fallback: if element hasn't arrived after 1.8s, reveal dialog cleanly centered
      // while keeping observer active so late-loading components latch on smoothly
      maxTimeout = window.setTimeout(() => {
        if (!cancelled) {
          setIsSettled(true);
        }
      }, 1800);
    }

    const onScrollOrResize = () => {
      if (cancelled) return;
      const el = findElement(selectorSpec);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setTarget({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            stepIndex,
          });
        }
      }
    };

    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);

    return () => {
      cancelled = true;
      if (pollInterval) window.clearInterval(pollInterval);
      if (settleTimer) window.clearTimeout(settleTimer);
      if (maxTimeout) window.clearTimeout(maxTimeout);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [isOpen, pathname, content, stepIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeGuide();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  if (!isOpen || !content) return null;

  // While aligning or waiting for the element to stabilize, do not show any premature highlight
  if (!isSettled) {
    return (
      <div className="fixed inset-0 z-100 bg-slate-950/40 transition-opacity duration-150" />
    );
  }

  const isLastStep = stepIndex === content.steps.length - 1;
  const activeTarget = target?.stepIndex === stepIndex ? target : null;

  // Safe tooltip coordinates preventing overflow
  const cardWidth = typeof window !== 'undefined' ? Math.min(380, window.innerWidth - 32) : 380;
  const cardHeight = 220;

  let tooltipTop: number | string = '50%';
  let tooltipLeft: number | string = '50%';
  let isCentered = false;

  const pad = 14;

  if (activeTarget && typeof window !== 'undefined') {
    const spaceBelow = window.innerHeight - (activeTarget.top + activeTarget.height);
    const spaceAbove = activeTarget.top;

    if (spaceBelow >= cardHeight + pad + 16 || spaceBelow >= spaceAbove) {
      tooltipTop = Math.min(window.innerHeight - cardHeight - 16, activeTarget.top + activeTarget.height + pad + 10);
    } else {
      tooltipTop = Math.max(16, activeTarget.top - cardHeight - pad - 10);
    }

    const idealLeft = activeTarget.left + activeTarget.width / 2 - cardWidth / 2;
    tooltipLeft = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, idealLeft));
  } else {
    isCentered = true;
  }

  return (
    <div className="fixed inset-0 z-100" role="dialog" aria-modal="true" aria-labelledby="page-guide-title">
      <div className="absolute inset-0 bg-slate-950/65" />
      {activeTarget && (
        <div
          className="fixed z-101 box-border rounded-xl border-2 border-cyan-300 shadow-[0_0_0_9999px_rgba(2,6,23,0.70),0_0_24px_rgba(34,211,238,0.55)] transition-all duration-150 pointer-events-none"
          style={{
            top: Math.max(4, activeTarget.top - pad),
            left: Math.max(4, activeTarget.left - pad),
            width: Math.min(typeof window !== 'undefined' ? window.innerWidth - 8 : activeTarget.width + pad * 2, activeTarget.width + pad * 2),
            height: Math.min(typeof window !== 'undefined' ? window.innerHeight - 8 : activeTarget.height + pad * 2, activeTarget.height + pad * 2),
          }}
        />
      )}
      <div
        className={`fixed z-102 w-[min(380px,calc(100vw-32px))] rounded-xl border border-cyan-400/50 bg-slate-900 p-5 shadow-2xl transition-all duration-150 ${isCentered ? '-translate-x-1/2 -translate-y-1/2' : ''}`}
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">{content.title} guide</p>
            <h2 id="page-guide-title" className="text-lg font-bold text-white">Step {stepIndex + 1} of {content.steps.length}</h2>
          </div>
          <button
            type="button"
            onClick={closeGuide}
            aria-label="Close page guide"
            title="Close page guide"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm leading-6 text-slate-300">{content.steps[stepIndex]}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
            disabled={stepIndex === 0}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:invisible"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={() => (isLastStep ? closeGuide() : setStepIndex((current) => current + 1))}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            {isLastStep ? 'Finish' : 'Next'}
            {!isLastStep && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

const guideRoutes = new Set([
  '/guide',
  '/learn',
  '/dashboard',
  '/squads',
  '/lineups',
  '/transfers',
  '/players',
  '/players/[id]',
  '/leagues',
  '/leaderboard',
  '/gameweeks',
  '/gameweeks/[id]',
  '/matches',
  '/matches/[id]',
  '/tournaments',
  '/tournaments/[id]',
  '/analytics',
  '/profile',
  '/account',
  '/settings',
  '/notifications',
  '/premium',
  '/help',
  '/rules',
]);

const tourRoutes = new Set([...guideRoutes].filter((route) => route !== '/guide' && route !== '/learn'));
const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/squads': 'Squad Overview',
  '/lineups': 'Lineup & Captaincy',
  '/transfers': 'Transfer Market',
  '/players': 'Players Directory',
  '/players/[id]': 'Player Profile',
  '/leagues': 'Leagues & Communities',
  '/leaderboard': 'Global Leaderboard',
  '/gameweeks': 'Gameweeks',
  '/gameweeks/[id]': 'Gameweek Detail',
  '/matches': 'Matches',
  '/matches/[id]': 'Match Detail',
  '/tournaments': 'Pro Tournaments',
  '/tournaments/[id]': 'Tournament Detail',
  '/analytics': 'Analytics',
  '/profile': 'Manager Profile',
  '/account': 'Account',
  '/settings': 'Settings',
  '/notifications': 'Notifications',
  '/premium': 'Premium',
  '/help': 'Help Center',
  '/rules': 'Rules & Scoring',
};

function normalizePath(pathname: string): string {
  return pathname.split('?')[0].split('#')[0] || '/';
}

function resolveDynamicRoute(pathname: string): string {
  if (/^\/players\/[^/]+$/.test(pathname)) return '/players/[id]';
  if (/^\/gameweeks\/[^/]+$/.test(pathname)) return '/gameweeks/[id]';
  if (/^\/matches\/[^/]+$/.test(pathname)) return '/matches/[id]';
  if (/^\/tournaments\/[^/]+$/.test(pathname)) return '/tournaments/[id]';
  return pathname;
}

export function getPageGuideKey(pathname: string): string | undefined {
  const route = resolveDynamicRoute(normalizePath(pathname));
  return guideRoutes.has(route) ? route : undefined;
}

export function getPageTourKey(pathname: string): string | undefined {
  const route = resolveDynamicRoute(normalizePath(pathname));
  return tourRoutes.has(route) ? route : undefined;
}

export function hasPageGuide(pathname: string): boolean {
  return getPageGuideKey(pathname) !== undefined;
}

export function hasPageTour(pathname: string): boolean {
  return getPageTourKey(pathname) !== undefined;
}

export function getPageGuideTitle(pathname: string): string {
  const normalized = normalizePath(pathname);
  if (normalized === '/guide') return 'Interactive Guide Directory';
  if (normalized === '/learn') return 'Learn Hub';
  const route = getPageTourKey(normalized);
  return route ? pageTitles[route] : 'Page guide';
}

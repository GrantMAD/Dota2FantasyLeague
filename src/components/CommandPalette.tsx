'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Compass, Search, Sparkles, X } from 'lucide-react';
import { useAccessibleDialog } from './use-accessible-dialog';
import type { SearchResultItem } from './header-types';

const staticNavigationItems: SearchResultItem[] = [
  { id: 'nav-dash', title: 'Dashboard', subtitle: 'Overview, stats and rank', category: 'Navigation', href: '/dashboard' },
  { id: 'nav-squads', title: 'My Squad', subtitle: 'Pitch formation and players', category: 'Navigation', href: '/squads' },
  { id: 'nav-lineups', title: 'Lineups', subtitle: 'Captain & Vice Captain pick', category: 'Navigation', href: '/lineups' },
  { id: 'nav-transfers', title: 'Transfer Market', subtitle: 'Buy and sell pro players', category: 'Navigation', href: '/transfers' },
  { id: 'nav-players', title: 'Players Directory', subtitle: 'Browse all pro statistics', category: 'Navigation', href: '/players' },
  { id: 'nav-leagues', title: 'Leagues', subtitle: 'Private & public standings', category: 'Navigation', href: '/leagues' },
  { id: 'nav-leaderboard', title: 'Leaderboard', subtitle: 'Top global fantasy managers', category: 'Navigation', href: '/leaderboard' },
  { id: 'nav-gameweeks', title: 'Gameweek Schedule', subtitle: 'Deadlines and fixtures', category: 'Navigation', href: '/gameweeks' },
  { id: 'nav-planner', title: 'My Squad Planner', subtitle: 'Squad availability and fixtures', category: 'Navigation', href: '/gameweeks/planner' },
  { id: 'nav-recap', title: 'Season Recap', subtitle: 'Review and share a finished season', category: 'Navigation', href: '/season-recap' },
  { id: 'nav-learn', title: 'Learn Hub', subtitle: 'Guide, rules and fantasy basics', category: 'Pages', href: '/learn' },
  { id: 'nav-premium', title: 'Premium Tools', subtitle: 'Advanced analytics and fantasy tools', category: 'Pages', href: '/premium' },
];

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [playerResults, setPlayerResults] = useState<SearchResultItem[]>([]);
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const commandPaletteRef = useAccessibleDialog<HTMLDivElement>({
    open: true,
    onClose,
    initialFocusRef: searchInputRef,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    let disposed = false;
    const timer = window.setTimeout(async () => {
      setIsSearchingPlayers(true);
      try {
        const response = await fetch(`/api/players?search=${encodeURIComponent(trimmed)}&limit=5`);
        if (!response.ok) throw new Error(`Player search failed (${response.status}).`);
        const json = await response.json();
        const players = Array.isArray(json.data) ? json.data : [];
        if (disposed) return;
        setPlayerResults(
          players.map((player: {
            id: number;
            name: string;
            in_game_name?: string | null;
            primary_role?: string | null;
            current_price?: number | null;
            professional_teams?: { name: string } | null;
          }) => ({
            id: player.id,
            title: player.in_game_name || player.name,
            subtitle: `${player.professional_teams?.name || 'Free Agent'} • ${player.primary_role || 'Player'}`,
            category: 'Players',
            href: `/players/${player.id}`,
            badge: player.current_price ? `$${Number(player.current_price).toFixed(1)}M` : undefined,
          })),
        );
      } catch (error) {
        if (!disposed) {
          console.error('Unable to search players from the command palette:', error);
          setPlayerResults([]);
        }
      } finally {
        if (!disposed) setIsSearchingPlayers(false);
      }
    }, 250);

    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const filteredSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return staticNavigationItems.slice(0, 5);
    const query = searchQuery.toLowerCase().trim();
    const matchedPages = staticNavigationItems.filter(
      (item) => item.title.toLowerCase().includes(query) || item.subtitle.toLowerCase().includes(query),
    );
    return [...playerResults, ...matchedPages];
  }, [searchQuery, playerResults]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={commandPaletteRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        tabIndex={-1}
        className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
      >
        <h2 id="command-palette-title" className="sr-only">Command palette</h2>
        <div className="flex items-center px-4 border-b border-slate-700/80 bg-slate-800/40">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            aria-label="Search players, pages, and rules"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              if (!event.target.value.trim()) setIsSearchingPlayers(false);
            }}
            placeholder="Search pro players, pages, rules... (Esc to close)"
            className="w-full bg-transparent px-3 py-3.5 text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          {searchQuery ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="p-1 rounded text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
              ESC
            </kbd>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {isSearchingPlayers && (
            <div role="status" aria-label="Searching players" className="space-y-1.5 p-1">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg p-2.5">
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-slate-800" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-2/5 animate-pulse rounded bg-slate-700" />
                    <div className="h-2.5 w-3/5 animate-pulse rounded bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {filteredSearchResults.length === 0 && !isSearchingPlayers && (
            <div className="p-8 text-center text-sm text-slate-400">
              No results found for &ldquo;<span className="text-white">{searchQuery}</span>&rdquo;
            </div>
          )}
          {filteredSearchResults.map((item) => (
            <button
              key={`${item.category}-${item.id}`}
              type="button"
              onClick={() => {
                onClose();
                router.push(item.href);
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-800 text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-md ${item.category === 'Players' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                  {item.category === 'Players' ? <Sparkles className="h-4 w-4" /> : <Compass className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-amber-400 transition-colors">{item.title}</p>
                  <p className="text-xs text-slate-400">{item.subtitle}</p>
                </div>
              </div>
              {item.badge && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 bg-slate-900/60 text-[11px] text-slate-500">
          <span>Select a result to navigate</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}

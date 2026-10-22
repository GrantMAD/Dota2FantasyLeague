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
  const [selectedIndex, setSelectedIndex] = useState(0);
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
            role: player.primary_role || undefined,
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
  const activeIndex = Math.min(selectedIndex, Math.max(0, filteredSearchResults.length - 1));

  function navigateToResult(item: SearchResultItem) {
    onClose();
    router.push(item.href);
  }

  function getRoleColor(role?: string) {
    const normalizedRole = role?.toLowerCase() ?? '';
    if (normalizedRole.includes('carry')) return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    if (normalizedRole.includes('mid')) return 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300';
    if (normalizedRole.includes('off')) return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300';
    if (normalizedRole.includes('support')) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    return 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)]';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/55 px-4 pt-20 backdrop-blur-md animate-in fade-in duration-150">
      <div
        ref={commandPaletteRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        tabIndex={-1}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-2xl shadow-slate-950/30 ring-1 ring-white/10"
      >
        <h2 id="command-palette-title" className="sr-only">Command palette</h2>
        <div className="flex items-center border-b border-[var(--border)] bg-[var(--surface-raised)] px-4">
          <Search className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
          <input
            ref={searchInputRef}
            type="text"
            aria-label="Search players, pages, and rules"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={filteredSearchResults.length > 0}
            aria-controls="command-palette-results"
            aria-activedescendant={filteredSearchResults.length > 0 ? `command-palette-result-${activeIndex}` : undefined}
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSelectedIndex(0);
              if (!event.target.value.trim()) setIsSearchingPlayers(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && filteredSearchResults.length > 0) {
                event.preventDefault();
                setSelectedIndex((index) => (Math.min(index, filteredSearchResults.length - 1) + 1) % filteredSearchResults.length);
              } else if (event.key === 'ArrowUp' && filteredSearchResults.length > 0) {
                event.preventDefault();
                setSelectedIndex((index) => (
                  Math.min(index, filteredSearchResults.length - 1) - 1 + filteredSearchResults.length
                ) % filteredSearchResults.length);
              } else if (event.key === 'Enter' && filteredSearchResults[activeIndex]) {
                event.preventDefault();
                navigateToResult(filteredSearchResults[activeIndex]);
              }
            }}
            placeholder="Search pro players, pages, rules... (Esc to close)"
            className="w-full bg-transparent px-3 py-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          {searchQuery ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
              Esc
            </kbd>
          )}
        </div>

        <div className="max-h-80 space-y-1 overflow-y-auto p-2">
          {isSearchingPlayers && (
            <div role="status" aria-label="Searching players" className="space-y-1.5 p-1">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg p-2.5">
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-[var(--surface-muted)]" />
                  <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-2/5 animate-pulse rounded bg-[var(--surface-muted)]" />
                  <div className="h-2.5 w-3/5 animate-pulse rounded bg-[var(--surface)]" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {filteredSearchResults.length === 0 && !isSearchingPlayers && (
            <div className="p-8 text-center text-sm text-[var(--text-secondary)]">
              No results found for &ldquo;<span className="text-[var(--text-primary)]">{searchQuery}</span>&rdquo;
            </div>
          )}
          <div id="command-palette-results" role="listbox" aria-label="Search results">
            {filteredSearchResults.map((item, index) => (
              <button
                key={`${item.category}-${item.id}`}
                id={`command-palette-result-${index}`}
                role="option"
                aria-selected={activeIndex === index}
                type="button"
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => navigateToResult(item)}
                className={`group flex w-full items-center justify-between rounded-xl p-2.5 text-left transition-colors ${
                  activeIndex === index
                    ? 'bg-[var(--surface-muted)] ring-1 ring-cyan-500/30'
                    : 'hover:bg-[var(--surface-raised)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${item.category === 'Players' ? getRoleColor(item.role) : 'bg-[var(--surface-raised)] text-[var(--text-muted)]'}`}>
                    {item.category === 'Players' ? <Sparkles className="h-4 w-4" /> : <Compass className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)] transition-colors group-hover:text-cyan-700 dark:group-hover:text-cyan-300">{item.title}</p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">{item.subtitle}</p>
                  </div>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  {item.badge && (
                    <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {item.badge}
                    </span>
                  )}
                  {activeIndex === index && (
                    <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text-muted)]">Enter</kbd>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2.5 text-[10px] text-[var(--text-muted)]">
          <span>Select a result to navigate</span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 font-mono">↑</kbd>
            <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 font-mono">↓</kbd>
            <span>navigate</span>
            <kbd className="ml-1 rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 font-mono">Enter</kbd>
            <span>open</span>
            <kbd className="ml-1 rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 font-mono">Esc</kbd>
            <span>close</span>
          </span>
        </div>
      </div>
    </div>
  );
}

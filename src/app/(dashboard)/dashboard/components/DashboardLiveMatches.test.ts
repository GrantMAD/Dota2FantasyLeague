import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

describe('DashboardLiveMatches', () => {
  it('renders full tournament and team names with theme-aware card colors', async () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const { DashboardLiveMatches } = await import('./DashboardLiveMatches');
    const tournamentName = 'The International Championship Qualifier';
    const radiantName = 'Very Long Radiant Esports Team Name';
    const direName = 'Another Extremely Long Dire Team Name';
    const markup = renderToStaticMarkup(React.createElement(DashboardLiveMatches, {
      matches: [{
        id: 177,
        status: 'live',
        scheduled_at: '2026-11-16T15:00:00.000Z',
        duration_seconds: 900,
        radiant_team_id: 1,
        dire_team_id: 2,
        winner_team_id: null,
        radiant_team: { id: 1, name: radiantName },
        dire_team: { id: 2, name: direName },
        tournaments: { id: 3, name: tournamentName, slug: 'international-qualifier' },
      }],
    }));

    expect(markup).toContain(tournamentName);
    expect(markup).toContain(radiantName);
    expect(markup).toContain(direName);
    expect(markup).toContain('overflow-wrap:anywhere');
    expect(markup).toContain('grid-cols-1 gap-4 md:grid-cols-2');
    expect(markup).toContain('border-b border-red-500/20');
    expect(markup).toContain('bg-red-500/60');
    expect(markup).toContain('linear-gradient(135deg');
    expect(markup).toContain('var(--surface)');
    expect(markup).toContain('var(--text-primary)');
  });
});

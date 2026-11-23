import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

describe('DashboardStatCards supporting text', () => {
  it('uses the card accent for supporting text and its decorative icon', async () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const { DashboardStatCards } = await import('./DashboardStatCards');
    const markup = renderToStaticMarkup(
      React.createElement(DashboardStatCards, {
        stats: [{
          icon: React.createElement('span'),
          label: 'Squad Value',
          value: '120.0M',
          trend: '12 players',
          supportingIcon: React.createElement('svg'),
          supportingAccent: '#34d399',
        }],
        onOpenPointsBreakdown: () => undefined,
      }),
    );

    expect(markup).toContain('color-mix(in srgb, var(--text-primary) 55%, #34d399)');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('12 players');
  });

  it('shows concise trend text and direction icons without repeating card actions', async () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const { DashboardStatCards } = await import('./DashboardStatCards');
    const markup = renderToStaticMarkup(
      React.createElement(DashboardStatCards, {
        stats: [
          {
            icon: React.createElement('span'),
            label: 'Total Points',
            value: 1402,
            trend: '+6.0 GW pts vs prior',
            trendColor: 'text-emerald-500',
            trendDirection: 'up',
          },
          {
            icon: React.createElement('span'),
            label: 'Global Rank',
            value: 42,
            trend: '2 places up vs prior GW',
            trendColor: 'text-emerald-500',
            trendDirection: 'up',
          },
        ],
        onOpenPointsBreakdown: () => undefined,
      }),
    );

    expect(markup).toContain('+6.0 GW pts vs prior');
    expect(markup).toContain('2 places up vs prior GW');
    expect(markup).not.toContain('· Breakdown');
    expect(markup).not.toContain('· View standings');
    expect(markup.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

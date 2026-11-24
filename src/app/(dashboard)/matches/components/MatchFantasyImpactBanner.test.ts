import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

describe('MatchFantasyImpactBanner', () => {
  it('renders an accessible info icon and bench-scoring tooltip for bench players while omitting it for starters', async () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const { MatchFantasyImpactBanner } = await import('./MatchFantasyImpactBanner');

    const markup = renderToStaticMarkup(
      React.createElement(MatchFantasyImpactBanner, {
        gameweekNumber: 7,
        seriesGames: [
          {
            id: 607,
            match_number: 1,
            scheduled_at: '2026-11-24T13:57:34Z',
            duration_seconds: 2100,
            playerStats: [
              {
                player_id: 178,
                hero_name: 'Slark',
                professional_players: { in_game_name: 'watson', primary_role: 'Carry' },
              },
              {
                player_id: 42,
                hero_name: 'Dazzle',
                professional_players: { in_game_name: 'Maladych', primary_role: 'Support' },
              },
            ],
            fantasyBreakdown: [
              { player_id: 178, total_points: 40.7 },
              { player_id: 42, total_points: 39.9 },
            ],
          },
        ],
        impact: {
          userOwnedPlayerIds: [178, 42],
          tripleCaptainActive: false,
          lineupDetails: [
            {
              playerId: 178,
              slot: 'Bench 1',
              isCaptain: false,
              isViceCaptain: false,
              isStarter: false,
            },
            {
              playerId: 42,
              slot: 'Hard Support',
              isCaptain: false,
              isViceCaptain: false,
              isStarter: true,
            },
          ],
        },
      }),
    );

    expect(markup).toContain('Your Fantasy Match Impact');
    expect(markup).toContain('aria-label="Explain bench scoring for watson"');
    expect(markup).not.toContain('aria-label="Explain bench scoring for Maladych"');
    expect(markup).toContain('role="tooltip"');
    expect(markup).toContain('Why Bench players show 0.0 pts here');
    expect(markup).toContain('automatically substitute in for Gameweek 7');
    expect(markup).toContain('Bench Boost');
    expect(markup).toContain('0.0 pts');
    expect(markup).toContain('+39.9 pts');
  });

  it('does not render the bench tooltip when a user has no saved lineup for an owned player', async () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const { MatchFantasyImpactBanner } = await import('./MatchFantasyImpactBanner');

    const markup = renderToStaticMarkup(
      React.createElement(MatchFantasyImpactBanner, {
        gameweekNumber: 7,
        seriesGames: [
          {
            id: 607,
            match_number: 1,
            scheduled_at: '2026-11-24T13:57:34Z',
            duration_seconds: 2100,
            playerStats: [
              {
                player_id: 178,
                hero_name: 'Slark',
                professional_players: { in_game_name: 'watson', primary_role: 'Carry' },
              },
            ],
            fantasyBreakdown: [{ player_id: 178, total_points: 40.7 }],
          },
        ],
        impact: {
          userOwnedPlayerIds: [178],
          tripleCaptainActive: false,
          lineupDetails: [],
        },
      }),
    );

    expect(markup).not.toContain('Explain bench scoring');
    expect(markup).toContain('+40.7 pts');
  });
});

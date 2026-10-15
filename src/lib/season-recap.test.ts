import {
  createSeasonRecapShareCardSvg,
  getSeasonRecapShareText,
  SEASON_RECAP_CARD_THEMES,
  type SeasonRecap,
} from './season-recap';

const recap: SeasonRecap = {
  seasonId: 4,
  fantasySeasonId: 19,
  seasonName: 'Season <One> & Friends',
  startDate: '2025-01-01T00:00:00.000Z',
  endDate: '2025-12-31T00:00:00.000Z',
  totalPoints: 1234.5,
  finalGlobalRank: 12,
  bestGameweek: { gameweek: 8, points: 95.5 },
  rankProgression: { startingRank: 42, finalRank: 12 },
  topPlayer: { name: 'Aegis & Shield', points: 250.2 },
  transferCount: 17,
  bestLeagueRank: 2,
};

describe('season recap sharing', () => {
  it('includes recap statistics without account or manager identifiers', () => {
    const text = getSeasonRecapShareText(recap);

    expect(text).toContain('Season points: 1234.5');
    expect(text).toContain('Best gameweek: GW 8 (95.5 points)');
    expect(text).toContain('Rank progress: #42 to #12');
    expect(text).toContain('Top-scoring pick: Aegis & Shield (250.2 points)');
    expect(text).not.toContain('fantasySeasonId');
    expect(text).not.toContain('seasonId');
    expect(text).not.toContain('userId');
  });

  it('escapes season and player content in the downloadable SVG card', () => {
    const svg = createSeasonRecapShareCardSvg(recap);

    expect(svg).toContain('Season &lt;One&gt; &amp; Friends');
    expect(svg).toContain('Aegis &amp; Shield');
    expect(svg).not.toContain('Season <One>');
    expect(svg).toContain('No manager name or account details included');
  });

  it('offers three distinct card themes while preserving the same recap content', () => {
    expect(SEASON_RECAP_CARD_THEMES.map(({ id }) => id)).toEqual(['radiant', 'dire', 'aegis']);

    const themedCards = SEASON_RECAP_CARD_THEMES.map((theme) => ({
      theme,
      svg: createSeasonRecapShareCardSvg(recap, theme.id),
    }));

    expect(new Set(themedCards.map(({ svg }) => svg)).size).toBe(3);
    for (const { theme, svg } of themedCards) {
      expect(svg).toContain(`stop-color="${theme.startColor}"`);
      expect(svg).toContain(`stop-color="${theme.endColor}"`);
      expect(svg).toContain(`stroke="${theme.borderColor}"`);
      expect(svg).toContain('Season points');
      expect(svg).toContain('1234.5');
      expect(svg).toContain('Aegis &amp; Shield');
      expect(svg).toContain('No manager name or account details included');
    }
  });
});

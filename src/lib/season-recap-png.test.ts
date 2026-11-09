import sharp from 'sharp';
import { renderSeasonRecapPng } from './season-recap-png';
import type { SeasonRecap } from './season-recap';

const recap: SeasonRecap = {
  seasonId: 1,
  fantasySeasonId: 2,
  seasonName: 'Season 2025',
  startDate: '2025-08-01',
  endDate: '2026-06-01',
  totalPoints: 1234.5,
  finalGlobalRank: 8,
  bestGameweek: { gameweek: 4, points: 321.5 },
  rankProgression: { startingRank: 100, finalRank: 8 },
  topPlayer: { name: 'Top Player', points: 240.5 },
  transferCount: 12,
  bestLeagueRank: 3,
};

describe('server-side Season Recap PNG renderer', () => {
  it('creates a PNG from the privacy-safe SVG card at its designed dimensions', async () => {
    const png = await renderSeasonRecapPng(recap, 'dire');
    const metadata = await sharp(png).metadata();

    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(metadata).toMatchObject({ format: 'png', width: 800, height: 640 });
  });
});

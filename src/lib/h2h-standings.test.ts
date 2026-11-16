import { calculateH2HStandings } from './h2h-standings';

describe('calculateH2HStandings', () => {
  it('ranks by league points, then score difference', () => {
    const standings = calculateH2HStandings(
      [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      [
        { participant_a_id: 1, participant_b_id: 2, points_a: 120, points_b: 100, is_bye: false, is_resolved: true },
        { participant_a_id: 1, participant_b_id: 3, points_a: 90, points_b: 100, is_bye: false, is_resolved: true },
        { participant_a_id: 2, participant_b_id: 3, points_a: 95, points_b: 100, is_bye: false, is_resolved: true },
        { participant_a_id: 2, participant_b_id: 4, points_a: 110, points_b: 100, is_bye: false, is_resolved: true },
        { participant_a_id: 3, participant_b_id: 4, points_a: 100, points_b: 100, is_bye: false, is_resolved: true },
      ],
    );

    expect(standings.map(({ participantId, rank, leaguePoints }) => ({ participantId, rank, leaguePoints }))).toEqual([
      { participantId: 3, rank: 1, leaguePoints: 7 },
      { participantId: 1, rank: 2, leaguePoints: 3 },
      { participantId: 2, rank: 3, leaguePoints: 3 },
      { participantId: 4, rank: 4, leaguePoints: 1 },
    ]);
  });

  it('uses points scored to break equal league-points and score-difference ties', () => {
    const standings = calculateH2HStandings(
      [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }],
      [
        { participant_a_id: 1, participant_b_id: 3, points_a: 120, points_b: 100, is_bye: false, is_resolved: true },
        { participant_a_id: 1, participant_b_id: 4, points_a: 80, points_b: 90, is_bye: false, is_resolved: true },
        { participant_a_id: 2, participant_b_id: 5, points_a: 90, points_b: 70, is_bye: false, is_resolved: true },
        { participant_a_id: 2, participant_b_id: 6, points_a: 70, points_b: 80, is_bye: false, is_resolved: true },
      ],
    );

    expect(standings.filter(({ participantId }) => participantId === 1 || participantId === 2).map(({ participantId, rank }) => ({
      participantId,
      rank,
    }))).toEqual([
      { participantId: 1, rank: 1 },
      { participantId: 2, rank: 2 },
    ]);
  });

  it('shares competition ranks when league points and score tie-breakers are equal', () => {
    const standings = calculateH2HStandings(
      [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      [
        { participant_a_id: 1, participant_b_id: 2, points_a: 100, points_b: 100, is_bye: false, is_resolved: true },
        { participant_a_id: 3, participant_b_id: 4, points_a: 100, points_b: 100, is_bye: false, is_resolved: true },
      ],
    );

    expect(standings.map(({ participantId, rank }) => ({ participantId, rank }))).toEqual([
      { participantId: 1, rank: 1 },
      { participantId: 2, rank: 1 },
      { participantId: 3, rank: 1 },
      { participantId: 4, rank: 1 },
    ]);
  });

  it('excludes unresolved fixtures and byes from records and tie-break points', () => {
    const standings = calculateH2HStandings(
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      [
        { participant_a_id: 1, participant_b_id: 2, points_a: 100, points_b: 50, is_bye: false, is_resolved: true },
        { participant_a_id: 1, participant_b_id: 3, points_a: 1000, points_b: 0, is_bye: false, is_resolved: false },
        { participant_a_id: 2, participant_b_id: 2, points_a: 0, points_b: 0, is_bye: true, is_resolved: true },
      ],
    );

    expect(standings).toEqual([
      expect.objectContaining({ participantId: 1, wins: 1, leaguePoints: 3, pointsFor: 100 }),
      expect.objectContaining({ participantId: 3, wins: 0, losses: 0, draws: 0, leaguePoints: 0, pointsFor: 0 }),
      expect.objectContaining({ participantId: 2, wins: 0, losses: 1, leaguePoints: 0, pointsFor: 50 }),
    ]);
  });
});

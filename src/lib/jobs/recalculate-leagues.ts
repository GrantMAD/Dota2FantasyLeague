import { createClient } from '@supabase/supabase-js';
import {
  deliverPushNotifications,
  type PushNotificationCandidate,
} from '@/lib/push-notifications';
import { calculateH2HStandings } from '@/lib/h2h-standings';

interface JobResult {
  success: boolean;
  leaguesProcessed: number;
  classicLeaguesUpdated: number;
  h2hFixturesGenerated: number;
  h2hResultsCalculated: number;
  errors: string[];
  duration: number;
}

interface ClassicParticipantRow {
  id: number;
  fantasy_seasons: { total_points: number | null } | null;
}

interface ParticipantIdRow {
  id: number;
}

interface MatchupParticipant {
  user_id: string;
  fantasy_season_id: number;
}

interface H2HMatchupRow {
  id: number;
  league_id: number;
  participant_a_id: number;
  participant_b_id: number;
  is_bye: boolean;
  participant_a: MatchupParticipant | null;
  participant_b: MatchupParticipant | null;
}

interface H2HStandingParticipantRow {
  id: number;
}

interface H2HStandingMatchupRow {
  participant_a_id: number;
  participant_b_id: number;
  points_a: number | null;
  points_b: number | null;
  is_bye: boolean;
  is_resolved: boolean;
}

interface LeagueRow {
  id: number;
  scoring_type: string;
}

interface GameweekRow {
  id: number;
  status: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class RecalculateLeagues {
  private supabase: ReturnType<typeof createClient>;
  private pushCandidates: PushNotificationCandidate[] = [];

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  // Helper to bypass strict Database generic inference when schema types are not generated for all tables
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private table(tableName: string): any {
    return this.supabase.from(tableName);
  }

  /**
   * Re-rank all participants in a classic league based on their total points
   */
  private async recalculateClassicLeague(leagueId: number): Promise<boolean> {
    try {
      // Get all participants in the league, joined with their fantasy season to get total points
      const { data: participantData, error: fetchError } = await this.supabase
        .from('league_participants')
        .select(`
          id,
          fantasy_seasons(total_points)
        `)
        .eq('league_id', leagueId);
      const participants = (participantData ?? []) as ClassicParticipantRow[];

      if (fetchError || !participants) {
        console.error(`Failed to fetch participants for classic league ${leagueId}:`, fetchError);
        return false;
      }

      // Sort by total points descending
      const sortedParticipants = participants.sort((a, b) => {
        const pointsA = a.fantasy_seasons?.total_points || 0;
        const pointsB = b.fantasy_seasons?.total_points || 0;
        return pointsB - pointsA;
      });

      // Update ranks and points in league_participants concurrently in batches
      const batchSize = 25;
      let rank = 1;
      for (let i = 0; i < sortedParticipants.length; i += batchSize) {
        const batch = sortedParticipants.slice(i, i + batchSize);
        await Promise.all(
          batch.map((p, idx) => {
            const currentRank = rank + idx;
            const points = p.fantasy_seasons?.total_points || 0;
            return this.table('league_participants')
              .update({ rank: currentRank, points })
              .eq('id', p.id);
          })
        );
        rank += batch.length;
      }

      return true;
    } catch (err: unknown) {
      console.error(`Error recalculating classic league ${leagueId}:`, err);
      return false;
    }
  }

  /**
   * Generate H2H fixtures for a given gameweek in a league
   */
  private async generateH2HFixtures(leagueId: number, gameweekId: number): Promise<number> {
    try {
      const { data: existingFixtures, error: existingFixturesError } = await this.supabase
        .from('head_to_head_matchups')
        .select('participant_a_id, participant_b_id')
        .eq('league_id', leagueId)
        .eq('gameweek_id', gameweekId);

      if (existingFixturesError) {
        throw new Error(`Failed to fetch existing fixtures: ${existingFixturesError.message}`);
      }

      const assignedParticipantIds = new Set<number>();
      const existingFixtureRows = (existingFixtures ?? []) as Array<{
        participant_a_id: number;
        participant_b_id: number;
      }>;
      for (const fixture of existingFixtureRows) {
        assignedParticipantIds.add(fixture.participant_a_id);
        assignedParticipantIds.add(fixture.participant_b_id);
      }

      // Fetch participants
      const { data: participantData, error: fetchError } = await this.supabase
        .from('league_participants')
        .select('id')
        .eq('league_id', leagueId);

      if (fetchError) {
        throw new Error(`Failed to fetch league participants: ${fetchError.message}`);
      }

      const participants = ((participantData ?? []) as ParticipantIdRow[])
        .filter((participant) => !assignedParticipantIds.has(participant.id));
      if (participants.length === 0) {
        return 0;
      }

      // Keep existing assignments and pair only participants not yet scheduled.
      const shuffled = [...participants].sort(() => Math.random() - 0.5);
      const fixturesToInsert: Record<string, unknown>[] = [];

      // Pair participants
      for (let i = 0; i < shuffled.length; i += 2) {
        const participantA = shuffled[i];
        const participantB = shuffled[i + 1];

        if (participantB) {
          fixturesToInsert.push({
            league_id: leagueId,
            gameweek_id: gameweekId,
            participant_a_id: participantA.id,
            participant_b_id: participantB.id,
            is_bye: false,
          });
        } else {
          fixturesToInsert.push({
            league_id: leagueId,
            gameweek_id: gameweekId,
            participant_a_id: participantA.id,
            participant_b_id: participantA.id,
            is_bye: true,
            is_resolved: true,
            winner_id: participantA.id,
          });
        }
      }

      const { error: insertError } = await this.table('head_to_head_matchups').insert(fixturesToInsert);
      if (insertError) {
        throw new Error(`Failed to insert H2H fixtures: ${insertError.message}`);
      }

      return fixturesToInsert.length;
    } catch (err: unknown) {
      throw new Error(`Error generating H2H fixtures for league ${leagueId}: ${errorMessage(err)}`);
    }
  }

  /** Calculate results for unresolved H2H matchups in a closed gameweek. */
  private async calculateH2HResults(gameweekId: number): Promise<number> {
    try {
      const { data: matchupData, error: matchupsError } = await this.supabase
        .from('head_to_head_matchups')
        .select(`
          id,
          league_id,
          participant_a_id,
          participant_b_id,
          participant_a:league_participants!participant_a_id(user_id, fantasy_season_id),
          participant_b:league_participants!participant_b_id(user_id, fantasy_season_id)
        `)
        .eq('gameweek_id', gameweekId)
        .eq('is_resolved', false)
        .eq('is_bye', false);
      if (matchupsError) throw new Error(`Failed to fetch unresolved H2H matchups: ${matchupsError.message}`);
      const matchups = (matchupData ?? []) as H2HMatchupRow[];

      if (matchups.length === 0) {
        return 0;
      }

      let resultsCalculated = 0;

      const { data: lineupData, error: lineupError } = await this.supabase
        .from('fantasy_lineups')
        .select('fantasy_season_id, total_points')
        .eq('gameweek_id', gameweekId);
      if (lineupError) throw new Error(`Failed to fetch H2H gameweek lineups: ${lineupError.message}`);

      const lineupPointsMap = new Map<number, number>();
      if (lineupData) {
        for (const row of lineupData as Array<{ fantasy_season_id: number | null; total_points: number | null }>) {
          if (row.fantasy_season_id != null) {
            lineupPointsMap.set(row.fantasy_season_id, Number(row.total_points ?? 0));
          }
        }
      }

      for (const matchup of matchups) {
        const fantasySeasonA = matchup.participant_a?.fantasy_season_id;
        const fantasySeasonB = matchup.participant_b?.fantasy_season_id;
        const userIdA = matchup.participant_a?.user_id;
        const userIdB = matchup.participant_b?.user_id;

        if (!fantasySeasonA || !fantasySeasonB) continue;

        const pointsA = lineupPointsMap.get(fantasySeasonA) ?? 0;
        const pointsB = lineupPointsMap.get(fantasySeasonB) ?? 0;

        let winnerId = null;
        let isDraw = false;

        if (pointsA > pointsB) {
          winnerId = matchup.participant_a_id;
        } else if (pointsB > pointsA) {
          winnerId = matchup.participant_b_id;
        } else {
          isDraw = true;
        }

        const { error: updateError } = await this.table('head_to_head_matchups')
          .update({
            points_a: pointsA,
            points_b: pointsB,
            winner_id: winnerId,
            is_resolved: true,
          })
          .eq('id', matchup.id);
        if (updateError) throw new Error(`Failed to resolve H2H matchup ${matchup.id}: ${updateError.message}`);

        // Dispatch notifications to both managers
        try {
          const notifTable = this.supabase.from('user_notifications') as unknown as {
            insert: (data: Record<string, unknown>[]) => PromiseLike<{ error: { message: string } | null }>;
          };
          const notifs: Record<string, unknown>[] = [];
          const pushCandidates: PushNotificationCandidate[] = [];

          if (userIdA) {
            const metadata = { gameweek_id: gameweekId, league_id: matchup.league_id, matchup_id: matchup.id };
            const titleA = isDraw ? 'H2H Matchup Tied!' : winnerId === matchup.participant_a_id ? 'You Won Your H2H Matchup!' : 'H2H Matchup Defeat';
            const msgA = isDraw
              ? `You drew your H2H fixture with ${pointsA.toFixed(1)} points.`
              : winnerId === matchup.participant_a_id
                ? `Victory! You scored ${pointsA.toFixed(1)} pts against ${pointsB.toFixed(1)} pts.`
                : `You scored ${pointsA.toFixed(1)} pts but fell short against ${pointsB.toFixed(1)} pts.`;
            notifs.push({
              user_id: userIdA,
              type: 'h2h_result',
              title: titleA,
              message: msgA,
              metadata,
            });
            pushCandidates.push({ userId: userIdA, type: 'h2h_result', metadata });
          }

          if (userIdB) {
            const metadata = { gameweek_id: gameweekId, league_id: matchup.league_id, matchup_id: matchup.id };
            const titleB = isDraw ? 'H2H Matchup Tied!' : winnerId === matchup.participant_b_id ? 'You Won Your H2H Matchup!' : 'H2H Matchup Defeat';
            const msgB = isDraw
              ? `You drew your H2H fixture with ${pointsB.toFixed(1)} points.`
              : winnerId === matchup.participant_b_id
                ? `Victory! You scored ${pointsB.toFixed(1)} pts against ${pointsA.toFixed(1)} pts.`
                : `You scored ${pointsB.toFixed(1)} pts but fell short against ${pointsA.toFixed(1)} pts.`;
            notifs.push({
              user_id: userIdB,
              type: 'h2h_result',
              title: titleB,
              message: msgB,
              metadata,
            });
            pushCandidates.push({ userId: userIdB, type: 'h2h_result', metadata });
          }

          if (notifs.length > 0) {
            const { error } = await notifTable.insert(notifs);
            if (error) throw new Error(error.message);
            this.pushCandidates.push(...pushCandidates);
          }
        } catch (notifErr) {
          console.warn('Failed to insert H2H matchup notifications:', notifErr);
        }

        resultsCalculated++;
      }

      return resultsCalculated;
    } catch (err: unknown) {
      throw new Error(`Error calculating H2H results for gameweek ${gameweekId}: ${errorMessage(err)}`);
    }
  }

  private async recalculateH2HLeague(leagueId: number): Promise<void> {
    const [{ data: participantData, error: participantsError }, { data: matchupData, error: matchupsError }] = await Promise.all([
      this.table('league_participants')
        .select('id')
        .eq('league_id', leagueId),
      this.table('head_to_head_matchups')
        .select('participant_a_id, participant_b_id, points_a, points_b, is_bye, is_resolved')
        .eq('league_id', leagueId)
        .eq('is_resolved', true),
    ]);

    if (participantsError) throw new Error(`Failed to fetch H2H participants for league ${leagueId}: ${participantsError.message}`);
    if (matchupsError) throw new Error(`Failed to fetch resolved H2H matchups for league ${leagueId}: ${matchupsError.message}`);

    const standings = calculateH2HStandings(
      (participantData ?? []) as H2HStandingParticipantRow[],
      (matchupData ?? []) as H2HStandingMatchupRow[],
    );
    const updates = await Promise.all(standings.map(async (standing) => {
      const { error } = await this.table('league_participants')
        .update({
          rank: standing.rank,
          wins: standing.wins,
          losses: standing.losses,
          draws: standing.draws,
        })
        .eq('id', standing.participantId);
      return error;
    }));

    const updateError = updates.find((error) => error !== null);
    if (updateError) throw new Error(`Failed to update H2H standings for league ${leagueId}: ${updateError.message}`);
  }


  async execute(): Promise<JobResult> {
    const startTime = Date.now();
    this.pushCandidates = [];
    const result: JobResult = {
      success: false,
      leaguesProcessed: 0,
      classicLeaguesUpdated: 0,
      h2hFixturesGenerated: 0,
      h2hResultsCalculated: 0,
      errors: [],
      duration: 0,
    };

    try {
      // 1. Fetch active leagues
      const { data: leagueData, error: leaguesError } = await this.supabase
        .from('leagues')
        .select('id, scoring_type')
        .eq('status', 'active');
      const leagues = (leagueData ?? []) as LeagueRow[];

      if (leaguesError) {
        result.errors.push(`Failed to fetch active leagues: ${leaguesError.message}`);
        result.duration = Date.now() - startTime;
        return result;
      }

      // 2. Fetch current active gameweek and recently closed gameweeks
      const { data: gameweekData, error: gameweeksError } = await this.supabase
        .from('gameweeks')
        .select('id, status')
        .in('status', ['active', 'closed']);
      if (gameweeksError) {
        result.errors.push(`Failed to fetch active and closed gameweeks: ${gameweeksError.message}`);
        result.duration = Date.now() - startTime;
        return result;
      }
      const gameweeks = (gameweekData ?? []) as GameweekRow[];
      
      const activeGameweek = gameweeks.find((gameweek) => gameweek.status === 'active');
      const closedGameweeks = gameweeks.filter((gameweek) => gameweek.status === 'closed');


      for (const league of leagues || []) {
        result.leaguesProcessed++;
        try {
          if (league.scoring_type === 'total_points') {
            // Classic League
            const success = await this.recalculateClassicLeague(league.id);
            if (success) result.classicLeaguesUpdated++;
          } else if (league.scoring_type === 'weekly_wins') {
            if (activeGameweek) {
              const generated = await this.generateH2HFixtures(league.id, activeGameweek.id);
              result.h2hFixturesGenerated += generated;
            }
          }
        } catch (err: unknown) {
          result.errors.push(`Error processing league ${league.id}: ${errorMessage(err)}`);
        }
      }

      for (const closedGw of closedGameweeks) {
        try {
          const calculated = await this.calculateH2HResults(closedGw.id);
          result.h2hResultsCalculated += calculated;
        } catch (err: unknown) {
          result.errors.push(`Error processing closed gameweek ${closedGw.id}: ${errorMessage(err)}`);
        }
      }

      for (const league of leagues.filter((item) => item.scoring_type === 'weekly_wins')) {
        try {
          await this.recalculateH2HLeague(league.id);
        } catch (err: unknown) {
          result.errors.push(`Error recalculating H2H league ${league.id}: ${errorMessage(err)}`);
        }
      }

      if (this.pushCandidates.length > 0) {
        try {
          const delivery = await deliverPushNotifications(this.supabase, this.pushCandidates);
          result.errors.push(...delivery.errors);
        } catch (pushError: unknown) {
          result.errors.push(`Unable to deliver H2H push notifications: ${errorMessage(pushError)}`);
        }
      }

      result.success = result.errors.length === 0;
    } catch (err: unknown) {
      result.errors.push(`Fatal error in recalculate leagues job: ${errorMessage(err)}`);
      console.error('Recalculate leagues job failed:', err);
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}

export async function recalculateLeagues(): Promise<JobResult> {
  const calculator = new RecalculateLeagues();
  return calculator.execute();
}

export default recalculateLeagues;

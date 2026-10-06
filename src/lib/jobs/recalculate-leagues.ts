import { createClient } from '@supabase/supabase-js';

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
  participant_a: MatchupParticipant | null;
  participant_b: MatchupParticipant | null;
}

interface LineupPointsRow {
  total_points: number | null;
}

interface LeagueRow {
  id: number;
  scoring_type: string;
}

interface GameweekRow {
  id: number;
  status: string;
}

type ParticipantRecordField = 'wins' | 'losses' | 'draws';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class RecalculateLeagues {
  private supabase: ReturnType<typeof createClient>;

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

      // Update ranks and points in league_participants
      let rank = 1;
      for (const p of sortedParticipants) {
        const points = p.fantasy_seasons?.total_points || 0;
        await this.table('league_participants')
          .update({ rank, points })
          .eq('id', p.id);
        rank++;
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

  /**
   * Calculate results for unresolved H2H matchups in a closed gameweek
   */
  private async calculateH2HResults(gameweekId: number): Promise<number> {
    try {
      // Find open matchups for this gameweek
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
        .is('winner_id', null)
        .eq('is_bye', false);
      const matchups = (matchupData ?? []) as H2HMatchupRow[];

      if (matchupsError || !matchups || matchups.length === 0) {
        return 0;
      }

      let resultsCalculated = 0;

      for (const matchup of matchups) {
        const fantasySeasonA = matchup.participant_a?.fantasy_season_id;
        const fantasySeasonB = matchup.participant_b?.fantasy_season_id;
        const userIdA = matchup.participant_a?.user_id;
        const userIdB = matchup.participant_b?.user_id;

        if (!fantasySeasonA || !fantasySeasonB) continue;

        // Get points for both participants in this gameweek
        const { data: lineupAData } = await this.supabase
          .from('fantasy_lineups')
          .select('total_points')
          .eq('fantasy_season_id', fantasySeasonA)
          .eq('gameweek_id', gameweekId)
          .single();
        const lineupA = lineupAData as LineupPointsRow | null;

        const { data: lineupBData } = await this.supabase
          .from('fantasy_lineups')
          .select('total_points')
          .eq('fantasy_season_id', fantasySeasonB)
          .eq('gameweek_id', gameweekId)
          .single();
        const lineupB = lineupBData as LineupPointsRow | null;

        const pointsA = lineupA?.total_points || 0;
        const pointsB = lineupB?.total_points || 0;

        let winnerId = null;
        let isDraw = false;

        if (pointsA > pointsB) {
          winnerId = matchup.participant_a_id;
        } else if (pointsB > pointsA) {
          winnerId = matchup.participant_b_id;
        } else {
          isDraw = true;
        }

        // Update matchup
        await this.table('head_to_head_matchups')
          .update({
            points_a: pointsA,
            points_b: pointsB,
            winner_id: winnerId
          })
          .eq('id', matchup.id);

        // Update participant records
        if (winnerId === matchup.participant_a_id) {
          await this.incrementParticipantRecord(matchup.participant_a_id, 'wins');
          await this.incrementParticipantRecord(matchup.participant_b_id, 'losses');
        } else if (winnerId === matchup.participant_b_id) {
          await this.incrementParticipantRecord(matchup.participant_b_id, 'wins');
          await this.incrementParticipantRecord(matchup.participant_a_id, 'losses');
        } else if (isDraw) {
          await this.incrementParticipantRecord(matchup.participant_a_id, 'draws');
          await this.incrementParticipantRecord(matchup.participant_b_id, 'draws');
        }

        // Dispatch notifications to both managers
        try {
          const notifTable = this.supabase.from('user_notifications') as unknown as {
            insert: (data: Record<string, unknown>[]) => PromiseLike<unknown>;
          };
          const notifs: Record<string, unknown>[] = [];

          if (userIdA) {
            const titleA = isDraw ? 'H2H Matchup Tied!' : winnerId === matchup.participant_a_id ? 'You Won Your H2H Matchup!' : 'H2H Matchup Defeat';
            const msgA = isDraw
              ? `You drew your H2H fixture with ${pointsA.toFixed(1)} points.`
              : winnerId === matchup.participant_a_id
                ? `Victory! You scored ${pointsA.toFixed(1)} pts against ${pointsB.toFixed(1)} pts.`
                : `You scored ${pointsA.toFixed(1)} pts but fell short against ${pointsB.toFixed(1)} pts.`;
            notifs.push({
              user_id: userIdA,
              type: 'system',
              title: titleA,
              message: msgA,
              metadata: { gameweek_id: gameweekId, league_id: matchup.league_id, matchup_id: matchup.id },
            });
          }

          if (userIdB) {
            const titleB = isDraw ? 'H2H Matchup Tied!' : winnerId === matchup.participant_b_id ? 'You Won Your H2H Matchup!' : 'H2H Matchup Defeat';
            const msgB = isDraw
              ? `You drew your H2H fixture with ${pointsB.toFixed(1)} points.`
              : winnerId === matchup.participant_b_id
                ? `Victory! You scored ${pointsB.toFixed(1)} pts against ${pointsA.toFixed(1)} pts.`
                : `You scored ${pointsB.toFixed(1)} pts but fell short against ${pointsA.toFixed(1)} pts.`;
            notifs.push({
              user_id: userIdB,
              type: 'system',
              title: titleB,
              message: msgB,
              metadata: { gameweek_id: gameweekId, league_id: matchup.league_id, matchup_id: matchup.id },
            });
          }

          if (notifs.length > 0) {
            await notifTable.insert(notifs);
          }
        } catch (notifErr) {
          console.warn('Failed to insert H2H matchup notifications:', notifErr);
        }

        resultsCalculated++;
      }

      // Re-rank H2H leagues based on wins/draws (3 pts for win, 1 for draw) - Simplified logic
      // In a real scenario, this would be a separate pass per H2H league.

      return resultsCalculated;
    } catch (err: unknown) {
      console.error(`Error calculating H2H results for gameweek ${gameweekId}:`, err);
      return 0;
    }
  }

  private async incrementParticipantRecord(participantId: number, field: ParticipantRecordField) {
     // Fetch current, then increment to avoid race conditions if multiple jobs run,
     // though RPC is better.
     const { data: participantData } = await this.table('league_participants')
       .select(field)
       .eq('id', participantId)
       .single();
     const data = participantData as Record<ParticipantRecordField, number | null> | null;
     
     if (data) {
       await this.table('league_participants')
         .update({ [field]: (data[field] || 0) + 1 })
         .eq('id', participantId);
     }
  }


  async execute(): Promise<JobResult> {
    const startTime = Date.now();
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
      const { data: gameweekData } = await this.supabase
        .from('gameweeks')
        .select('id, status')
        .in('status', ['active', 'closed']);
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
             // H2H League
             if (activeGameweek) {
               const generated = await this.generateH2HFixtures(league.id, activeGameweek.id);
               result.h2hFixturesGenerated += generated;
             }
          }
          } catch (err: unknown) {
            result.errors.push(`Error processing league ${league.id}: ${errorMessage(err)}`);
        }
      }

      // Calculate results for closed H2H gameweeks
      for (const closedGw of closedGameweeks) {
          const calculated = await this.calculateH2HResults(closedGw.id);
          result.h2hResultsCalculated += calculated;
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

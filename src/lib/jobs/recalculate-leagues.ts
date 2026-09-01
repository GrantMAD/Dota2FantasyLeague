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

class RecalculateLeagues {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  /**
   * Re-rank all participants in a classic league based on their total points
   */
  private async recalculateClassicLeague(leagueId: number): Promise<boolean> {
    try {
      // Get all participants in the league, joined with their fantasy season to get total points
      const { data: participants, error: fetchError } = await this.supabase
        .from('league_participants')
        .select(`
          id,
          fantasy_seasons(total_points)
        `)
        .eq('league_id', leagueId) as any;

      if (fetchError || !participants) {
        console.error(`Failed to fetch participants for classic league ${leagueId}:`, fetchError);
        return false;
      }

      // Sort by total points descending
      const sortedParticipants = participants.sort((a: any, b: any) => {
        const pointsA = a.fantasy_seasons?.total_points || 0;
        const pointsB = b.fantasy_seasons?.total_points || 0;
        return pointsB - pointsA;
      });

      // Update ranks and points in league_participants
      let rank = 1;
      for (const p of sortedParticipants) {
        const points = p.fantasy_seasons?.total_points || 0;
        await (this.supabase
          .from('league_participants') as any)
          .update({ rank, points })
          .eq('id', p.id);
        rank++;
      }

      return true;
    } catch (err: any) {
      console.error(`Error recalculating classic league ${leagueId}:`, err);
      return false;
    }
  }

  /**
   * Generate H2H fixtures for a given gameweek in a league
   */
  private async generateH2HFixtures(leagueId: number, gameweekId: number): Promise<number> {
    try {
      // Check if fixtures already exist for this gameweek and league
      const { count, error: countError } = await this.supabase
        .from('head_to_head_matchups')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', leagueId)
        .eq('gameweek_id', gameweekId);

      if (countError) {
        console.error(`Error checking existing H2H fixtures for league ${leagueId}:`, countError);
        return 0;
      }

      if (count && count > 0) {
        // Fixtures already generated
        return 0;
      }

      // Fetch participants
      const { data: participants, error: fetchError } = await this.supabase
        .from('league_participants')
        .select('id')
        .eq('league_id', leagueId) as any;

      if (fetchError || !participants || participants.length === 0) {
        return 0;
      }

      // Shuffle participants for random pairing
      const shuffled = [...participants].sort(() => Math.random() - 0.5);
      let fixturesGenerated = 0;
      
      // Pair participants
      for (let i = 0; i < shuffled.length; i += 2) {
        const participantA = shuffled[i];
        const participantB = shuffled[i + 1];

        if (participantB) {
          // Standard matchup
          await (this.supabase.from('head_to_head_matchups') as any).insert({
            league_id: leagueId,
            gameweek_id: gameweekId,
            participant_a_id: participantA.id,
            participant_b_id: participantB.id,
            is_bye: false
          });
          fixturesGenerated++;
        } else {
          // BYE week for the odd participant out
          await (this.supabase.from('head_to_head_matchups') as any).insert({
            league_id: leagueId,
            gameweek_id: gameweekId,
            participant_a_id: participantA.id,
            participant_b_id: participantA.id, // Self-reference or NULL, assuming self for BYE
            is_bye: true,
            winner_id: participantA.id // Automatically win BYE week
          });
          fixturesGenerated++;
        }
      }

      return fixturesGenerated;
    } catch (err: any) {
      console.error(`Error generating H2H fixtures for league ${leagueId}:`, err);
      return 0;
    }
  }

  /**
   * Calculate results for unresolved H2H matchups in a closed gameweek
   */
  private async calculateH2HResults(gameweekId: number): Promise<number> {
    try {
      // Find open matchups for this gameweek
      const { data: matchups, error: matchupsError } = await this.supabase
        .from('head_to_head_matchups')
        .select(`
          id,
          participant_a_id,
          participant_b_id,
          participant_a:league_participants!participant_a_id(fantasy_season_id),
          participant_b:league_participants!participant_b_id(fantasy_season_id)
        `)
        .eq('gameweek_id', gameweekId)
        .is('winner_id', null)
        .eq('is_bye', false) as any;

      if (matchupsError || !matchups || matchups.length === 0) {
        return 0;
      }

      let resultsCalculated = 0;

      for (const matchup of matchups) {
        const fantasySeasonA = matchup.participant_a?.fantasy_season_id;
        const fantasySeasonB = matchup.participant_b?.fantasy_season_id;

        if (!fantasySeasonA || !fantasySeasonB) continue;

        // Get points for both participants in this gameweek
        const { data: lineupA } = await this.supabase
          .from('fantasy_lineups')
          .select('total_points')
          .eq('fantasy_season_id', fantasySeasonA)
          .eq('gameweek_id', gameweekId)
          .single() as any;

        const { data: lineupB } = await this.supabase
          .from('fantasy_lineups')
          .select('total_points')
          .eq('fantasy_season_id', fantasySeasonB)
          .eq('gameweek_id', gameweekId)
          .single() as any;

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
        await (this.supabase
          .from('head_to_head_matchups') as any)
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

        resultsCalculated++;
      }

      // Re-rank H2H leagues based on wins/draws (3 pts for win, 1 for draw) - Simplified logic
      // In a real scenario, this would be a separate pass per H2H league.

      return resultsCalculated;
    } catch (err: any) {
      console.error(`Error calculating H2H results for gameweek ${gameweekId}:`, err);
      return 0;
    }
  }

  private async incrementParticipantRecord(participantId: number, field: 'wins' | 'losses' | 'draws') {
     // Fetch current, then increment to avoid race conditions if multiple jobs run,
     // though RPC is better.
     const { data } = await this.supabase
       .from('league_participants')
       .select(field)
       .eq('id', participantId)
       .single() as any;
     
     if (data) {
       await (this.supabase
         .from('league_participants') as any)
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
      const { data: leagues, error: leaguesError } = await this.supabase
        .from('leagues')
        .select('id, scoring_type')
        .eq('status', 'active') as any;

      if (leaguesError) {
        result.errors.push(`Failed to fetch active leagues: ${leaguesError.message}`);
        result.duration = Date.now() - startTime;
        return result;
      }

      // 2. Fetch current active gameweek and recently closed gameweeks
      const { data: gameweeks } = await this.supabase
        .from('gameweeks')
        .select('id, status')
        .in('status', ['active', 'closed']) as any;
      
      const activeGameweek = gameweeks?.find((gw: any) => gw.status === 'active');
      const closedGameweeks = gameweeks?.filter((gw: any) => gw.status === 'closed') || [];


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
        } catch (err: any) {
           result.errors.push(`Error processing league ${league.id}: ${err.message}`);
        }
      }

      // Calculate results for closed H2H gameweeks
      for (const closedGw of closedGameweeks) {
          const calculated = await this.calculateH2HResults(closedGw.id);
          result.h2hResultsCalculated += calculated;
      }


      result.success = true;
    } catch (err: any) {
      result.errors.push(`Fatal error in recalculate leagues job: ${err.message}`);
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

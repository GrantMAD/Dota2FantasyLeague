import { createClient } from '@supabase/supabase-js';

interface JobResult {
  success: boolean;
  matchesProcessed: number;
  scoresCalculated: number;
  gameweeksUpdated: number;
  errors: string[];
  duration: number;
}

interface MatchPlayerStats {
  id: string;
  match_id: number;
  player_id: number;
  team_id: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_minute: number;
  experience_per_minute: number;
  last_hits: number;
  denies: number;
  hero_damage: number;
  tower_damage: number;
  healing: number;
  wards_placed: number;
  wards_destroyed: number;
  roshan_kills: number;
}

interface Match {
  id: number;
  gameweek_id: number;
  duration_minutes: number;
  winner_team_id: number;
}

interface ScoringRules {
  [key: string]: number;
}

interface ScoreBreakdown {
  combat: number;
  economy: number;
  objective: number;
  teamfight: number;
  win: number;
  series: number;
  performance: number;
  consistency: number;
  penalty: number;
}

interface PlayerRole {
  role: string;
}

export class FantasyScoreCalculator {
  private supabase: ReturnType<typeof createClient>;
  private scoringRules: ScoringRules = {};

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  // Load scoring rules from database for a specific season
  async loadScoringRules(seasonId: number): Promise<void> {
    // First find the latest published version
    const { data: versionData, error: versionError } = await this.supabase
      .from('scoring_rules')
      .select('version')
      .eq('season_id', seasonId)
      .eq('is_published', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const version = (versionData as any)?.version || 1;

    // Load enabled rules for that version
    const { data, error } = await this.supabase
      .from('scoring_rules')
      .select('rule_key, value')
      .eq('season_id', seasonId)
      .eq('version', version)
      .eq('is_enabled', true);

    if (error && !versionError) {
      console.warn('Failed to load scoring rules:', error);
      this.setDefaultScoringRules();
      return;
    }

    this.scoringRules = {};
    data?.forEach((rule: any) => {
      this.scoringRules[rule.rule_key] = rule.value;
    });
  }

  private setDefaultScoringRules(): void {
    this.scoringRules = {
      kill_points: 1.5,
      death_points: -1.0,
      assist_points: 0.75,
      gpm_multiplier: 0.001,
      xpm_multiplier: 0.0005,
      lh_multiplier: 0.1,
      denies_multiplier: 0.05,
      hero_damage_multiplier: 0.0001,
      tower_damage_multiplier: 0.0002,
      healing_multiplier: 0.0001,
      wards_placed_points: 0.5,
      wards_destroyed_points: 0.3,
      roshan_kill_points: 2.0,
      win_points: 5.0,
      series_win_bonus: 3.0,
      performance_90_bonus: 5.0,
      performance_80_bonus: 3.0,
      performance_70_bonus: 1.0,
    };
  }

  /**
   * Calculate combat score (kills, deaths, assists, KDA efficiency)
   */
  private calculateCombatScore(stats: MatchPlayerStats, playerRole: string): number {
    const deathMultiplier = this.scoringRules.death_penalty !== undefined 
      ? this.scoringRules.death_penalty 
      : (this.scoringRules.death_points ?? -1.0);
    const killMultiplier = this.scoringRules.kill_points ?? 1.5;
    const assistMultiplier = this.scoringRules.assist_points ?? 0.75;

    const baseKills = stats.kills * killMultiplier;
    const baseDeaths = stats.deaths * deathMultiplier;
    const baseAssists = stats.assists * assistMultiplier;

    let score = baseKills + baseDeaths + baseAssists;

    // KDA efficiency bonus (simplified)
    const kda = stats.deaths === 0 ? stats.kills + stats.assists : (stats.kills + stats.assists) / stats.deaths;
    if (kda >= 5.0) score += 2.0;
    else if (kda >= 3.0) score += 1.0;

    return Math.max(0, score);
  }

  /**
   * Calculate economy score (GPM, XPM, last hits, denies - role-adjusted)
   */
  private calculateEconomyScore(
    stats: MatchPlayerStats,
    playerRole: string,
    gameDuration: number,
  ): number {
    // Expected GPM/XPM by role (typical values)
    const roleExpectations: { [key: string]: { gpm: number; xpm: number } } = {
      Carry: { gpm: 550, xpm: 600 },
      Mid: { gpm: 450, xpm: 550 },
      Offlane: { gpm: 350, xpm: 450 },
      Support: { gpm: 250, xpm: 350 },
      'Hard Support': { gpm: 200, xpm: 300 },
    };

    const expectations = roleExpectations[playerRole] || roleExpectations.Support;

    // Normalize by game duration
    const gpmScore = Math.min(stats.gold_per_minute / expectations.gpm, 1.5) * 5.0;
    const xpmScore = Math.min(stats.experience_per_minute / expectations.xpm, 1.5) * 4.0;

    // Last hits (normalized by role and duration)
    const expectedLH = (gameDuration / 60) * (playerRole === 'Carry' ? 6 : playerRole === 'Mid' ? 5 : 3);
    const lhScore = Math.min(stats.last_hits / expectedLH, 1.3) * 2.0;

    // Denies (small bonus)
    const deniesScore = stats.denies * 0.1;

    return gpmScore + xpmScore + lhScore + deniesScore;
  }

  /**
   * Calculate objective contribution score (hero damage, tower damage, healing, wards, Roshan)
   */
  private calculateObjectiveScore(stats: MatchPlayerStats, playerRole: string): number {
    // Role-adjusted expectations
    const roleExpectations: { [key: string]: { damage: number; tower: number; healing: number } } = {
      Carry: { damage: 25000, tower: 3000, healing: 1000 },
      Mid: { damage: 20000, tower: 2000, healing: 1500 },
      Offlane: { damage: 18000, tower: 2500, healing: 2000 },
      Support: { damage: 12000, tower: 1500, healing: 5000 },
      'Hard Support': { damage: 10000, tower: 1000, healing: 6000 },
    };

    const expectations = roleExpectations[playerRole] || roleExpectations.Support;

    const heroDamageScore = Math.min(stats.hero_damage / expectations.damage, 1.5) * 4.0;
    const towerDamageScore = Math.min(stats.tower_damage / expectations.tower, 1.5) * 2.0;
    const healingScore = Math.min(stats.healing / expectations.healing, 1.5) * 3.0;
    const roshanKillPts = this.scoringRules.roshan_kill_points ?? 2.0;
    const wardPlacedPts = this.scoringRules.ward_placed_points ?? this.scoringRules.wards_placed_points ?? 0.5;
    const wardDestroyedPts = this.scoringRules.ward_kill_points ?? this.scoringRules.wards_destroyed_points ?? 0.3;

    const roshanScore = stats.roshan_kills * roshanKillPts;
    const wardPlacedScore = stats.wards_placed * wardPlacedPts;
    const wardDestroyedScore = stats.wards_destroyed * wardDestroyedPts;

    return heroDamageScore + towerDamageScore + healingScore + roshanScore + wardPlacedScore + wardDestroyedScore;
  }

  /**
   * Calculate performance index bonus (normalized overall performance)
   */
  private calculatePerformanceBonus(
    combatScore: number,
    economyScore: number,
    objectiveScore: number,
  ): number {
    const totalScore = combatScore + economyScore + objectiveScore;
    const performanceIndex = Math.min(totalScore / 20, 100); // Normalize to 0-100

    if (performanceIndex >= 90) return this.scoringRules.performance_90_bonus;
    if (performanceIndex >= 80) return this.scoringRules.performance_80_bonus;
    if (performanceIndex >= 70) return this.scoringRules.performance_70_bonus;
    return 0;
  }

  /**
   * Calculate final score breakdown for a player's match performance
   */
  async calculatePlayerMatchScore(
    stats: MatchPlayerStats,
    match: Match,
    playerTeamId: number,
  ): Promise<ScoreBreakdown> {
    // Get player role from professional_players table
    const { data: playerData } = await this.supabase
      .from('professional_players')
      .select('primary_role')
      .eq('id', stats.player_id)
      .single();

    const playerRole = (playerData as any)?.primary_role || 'Support';

    // Calculate component scores
    const combat = this.calculateCombatScore(stats, playerRole);
    const economy = this.calculateEconomyScore(stats, playerRole, match.duration_minutes || 40);
    const objective = this.calculateObjectiveScore(stats, playerRole);
    const performance = this.calculatePerformanceBonus(combat, economy, objective);

    // Win bonus (only if player's team won)
    const winBonus = this.scoringRules.win_points !== undefined 
      ? this.scoringRules.win_points 
      : (this.scoringRules.match_win_bonus ?? 5.0);
    const win = playerTeamId === match.winner_team_id ? winBonus : 0;

    // Penalties (placeholder for now - could add for unusual stats)
    const penalty = 0;

    return {
      combat: Math.round(combat * 100) / 100,
      economy: Math.round(economy * 100) / 100,
      objective: Math.round(objective * 100) / 100,
      teamfight: 0, // Aggregated in consistency/performance
      win: Math.round(win * 100) / 100,
      series: 0, // Calculated when series is complete
      performance: Math.round(performance * 100) / 100,
      consistency: 0, // Calculated from rolling average
      penalty: Math.round(penalty * 100) / 100,
    };
  }

  /**
   * Main job entry point: process completed matches and calculate scores
   */
  async execute(): Promise<JobResult> {
    const startTime = Date.now();
    const result: JobResult = {
      success: false,
      matchesProcessed: 0,
      scoresCalculated: 0,
      gameweeksUpdated: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Get all matches with detailed stats that haven't been scored yet
      const { data: matchData, error: matchError } = (await this.supabase
        .from('matches')
        .select(
          `
          id, 
          gameweek_id, 
          duration_minutes, 
          winner_team_id,
          gameweeks(id)
        `,
        )
        .eq('status', 'completed')
        .not('detailed_stats_fetched_at', 'is', null)) as any;

      const matches: any[] = Array.isArray(matchData) ? matchData : [];

      if (matchError) {
        result.errors.push(`Failed to fetch matches: ${matchError.message}`);
        result.duration = Date.now() - startTime;
        return result;
      }

      if (matches.length === 0) {
        console.log('No completed matches to process');
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Get a sample season to load scoring rules
      const { data: seasonData } = (await this.supabase
        .from('seasons')
        .select('id')
        .eq('status', 'active')
        .limit(1)) as any;
      const seasonList: any[] = Array.isArray(seasonData) ? seasonData : [];
      if (seasonList.length > 0) {
        await this.loadScoringRules(seasonList[0].id);
      } else {
        this.setDefaultScoringRules();
      }

      const updatedGameweeks = new Set<number>();
      const matchCount = matches.length;
      console.log(`[CalculateScores] Processing fantasy scores for ${matchCount} matches...`);

      // Pre-load all professional player roles into memory map so we don't query 1-by-1
      const { data: allPlayers } = await (this.supabase
        .from('professional_players') as any)
        .select('id, primary_role');
      const roleMap = new Map<number, string>(
        (allPlayers || []).map((p: any) => [p.id, p.primary_role || 'Support'])
      );

      // Process in chunks of 20 matches
      const CHUNK_SIZE = 20;
      for (let i = 0; i < matchCount; i += CHUNK_SIZE) {
        const chunk = matches.slice(i, i + CHUNK_SIZE);
        const matchIds = chunk.map((m: any) => m.id);
        const matchMap = new Map<number, Match>(chunk.map((m: any) => [m.id, m]));

        // Fetch stats, substitutions, and performance IDs for this chunk in parallel
        const [statsRes, subsRes, perfsRes] = await Promise.all([
          this.supabase.from('match_player_stats').select('*').in('match_id', matchIds),
          this.supabase.from('match_player_substitutions').select('*').in('match_id', matchIds),
          this.supabase.from('player_performances').select('id, player_id, match_id').in('match_id', matchIds),
        ]);

        if (statsRes.error) {
          result.errors.push(`Failed to fetch stats for matches chunk ${i}-${i + chunk.length}: ${statsRes.error.message}`);
          continue;
        }

        const playerStats: any[] = (statsRes.data as any[]) || [];
        const substitutions: any[] = (subsRes.data as any[]) || [];
        const perfs: any[] = (perfsRes.data as any[]) || [];

        // Build quick lookup for performance_id
        const perfMap = new Map<string, string>();
        perfs.forEach((p: any) => {
          perfMap.set(`${p.player_id}_${p.match_id}`, p.id);
        });

        // Build quick lookup for substitutions
        const subMap = new Map<string, number>();
        substitutions.forEach((s: any) => {
          subMap.set(`${s.match_id}_${s.stand_in_player_id}`, s.rostered_player_id);
        });

        const breakdownsToUpsert: any[] = [];

        for (const stats of playerStats) {
          const match = matchMap.get(stats.match_id);
          if (!match) continue;

          const rosteredId = subMap.get(`${stats.match_id}_${stats.player_id}`);
          const targetPlayerId = rosteredId || stats.player_id;

          const performanceId = perfMap.get(`${targetPlayerId}_${stats.match_id}`);
          if (!performanceId) {
            continue; // Will be skipped if performances haven't been created yet
          }

          const playerRole = roleMap.get(stats.player_id) || 'Support';
          const combat = this.calculateCombatScore(stats, playerRole);
          const economy = this.calculateEconomyScore(stats, playerRole, match.duration_minutes || 40);
          const objective = this.calculateObjectiveScore(stats, playerRole);
          const performance = this.calculatePerformanceBonus(combat, economy, objective);
          const winBonus = this.scoringRules.win_points !== undefined 
            ? this.scoringRules.win_points 
            : (this.scoringRules.match_win_bonus ?? 5.0);
          const win = match.winner_team_id === (stats as any).team_id ? winBonus : 0;

          breakdownsToUpsert.push({
            performance_id: performanceId,
            combat_points: Math.round(combat * 100) / 100,
            economy_points: Math.round(economy * 100) / 100,
            objective_points: Math.round(objective * 100) / 100,
            teamfight_points: 0,
            win_points: Math.round(win * 100) / 100,
            series_points: 0,
            performance_index_points: Math.round(performance * 100) / 100,
            consistency_points: 0,
            penalty_points: 0,
          });

          if (match.gameweek_id) updatedGameweeks.add(match.gameweek_id);
        }

        if (breakdownsToUpsert.length > 0) {
          const { error: upsertError } = await (this.supabase
            .from('fantasy_points_breakdown') as any)
            .upsert(breakdownsToUpsert, { onConflict: 'performance_id' });

          if (upsertError) {
            result.errors.push(`Failed to upsert breakdown chunk: ${upsertError.message}`);
          } else {
            result.scoresCalculated += breakdownsToUpsert.length;
          }
        }

        result.matchesProcessed += chunk.length;
        console.log(`[CalculateScores] Processed ${result.matchesProcessed}/${matchCount} matches (${result.scoresCalculated} scores saved)...`);
      }

      result.gameweeksUpdated = updatedGameweeks.size;
      result.success = true;
      console.log(`[CalculateScores] Completed in ${Date.now() - startTime}ms. Calculated ${result.scoresCalculated} scores across ${result.gameweeksUpdated} gameweeks.`);
    } catch (err: any) {
      result.errors.push(`Fatal error in score calculation job: ${err.message}`);
      console.error('Score calculation job failed:', err);
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}

export async function calculateFantasyScores(): Promise<JobResult> {
  const calculator = new FantasyScoreCalculator();
  return calculator.execute();
}

export default calculateFantasyScores;

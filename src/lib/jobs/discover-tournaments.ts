/**
 * Tournament Discovery Job
 * 
 * Discovers new tournaments from data provider
 * and creates tournament records in the database
 * 
 * Run schedule: Every 6 hours
 */

import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import type { DataProvider, TournamentData } from '../data-providers/provider-interface';
import type { Tournament } from '@/types/database';

interface DiscoveryResult {
  discovered: number;
  updated: number;
  errors: string[];
  duration: number;
  startedAt: Date;
  completedAt: Date;
}

export async function discoverTournaments(): Promise<DiscoveryResult> {
  const startedAt = new Date();
  const result: DiscoveryResult = {
    discovered: 0,
    updated: 0,
    errors: [],
    duration: 0,
    startedAt,
    completedAt: new Date(),
  };

  try {
    const { getMatchDataProvider, getOpenDotaProvider } = await import('../data-providers/provider-config');
    const providers: Array<{ source: TournamentProvider; provider: DataProvider }> = [
      { source: 'stratz', provider: await getMatchDataProvider() },
      { source: 'opendota', provider: getOpenDotaProvider() },
    ];

    console.log('[discoverTournaments] Starting tournament discovery');

    const jobExecutionId = await logJobExecution('discover-tournaments', 'started');

    try {
      const sourceOutcomes = await Promise.all(providers.map(async ({ source, provider }) => ({
        source,
        outcome: await provider.fetchTournaments({ limit: 100 })
          .then((tournaments) => ({ tournaments }))
          .catch((error: unknown) => ({ error })),
      })));
      const sourceResults = sourceOutcomes.flatMap(({ source, outcome }) => {
        if ('error' in outcome) {
          result.errors.push(`Failed to fetch tournaments from ${source}: ${(outcome.error as Error).message}`);
          return [];
        }
        return [{ source, tournaments: outcome.tournaments }];
      });
      if (sourceResults.length === 0) {
        throw new Error('Tournament discovery failed for all configured providers');
      }
      const upcomingTournaments = sourceResults.flatMap(({ source, tournaments }) =>
        tournaments
          .filter((tournament) => tournament.status === 'upcoming' || tournament.status === 'active')
          .map((tournament) => ({ source, tournament })),
      );

      console.log(`[discoverTournaments] Found ${upcomingTournaments.length} upcoming or active tournaments across ${providers.length} providers`);

      // Get existing tournaments — keyed by data_provider_id for reliable lookup
      const existingTournaments = await getExistingTournaments();
      const supabase = getSupabaseServerClient();

      // Process each tournament
      for (const { source, tournament } of upcomingTournaments) {
        try {
          // Look up by the provider's own ID (stored as data_provider_id)
          const providerId = String(tournament.id);
          const existingLookup = findExistingTournament(existingTournaments, source, providerId, tournament);
          if (existingLookup.ambiguous) {
            throw new Error(
              `Multiple existing tournaments match provider ID or name/year for ${tournament.name}; skipped to avoid updating or duplicating the wrong tournament`
            );
          }
          const existing = existingLookup.tournament;
          if (existing && (existing.data_provider ?? 'stratz') !== source) {
            console.log(
              `[discoverTournaments] Skipping ${source} duplicate "${tournament.name}"; ` +
              `it is already tracked by ${existing.data_provider ?? 'stratz'}`
            );
            continue;
          }

          const startDate = validDate(tournament.startDate, 'start date', tournament);
          const endDate = tournament.endDate
            ? validDate(tournament.endDate, 'end date', tournament)
            : new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
          const startDateString = startDate.toISOString().slice(0, 10);
          const endDateString = endDate.toISOString().slice(0, 10);
          const previousIdentity = existing
            ? tournamentIdentity(existing.name, new Date(existing.start_date))
            : null;

          if (existing) {
            // Update existing tournament
            const { error } = await supabase
              .from('tournaments')
              .update({
                name: tournament.name,
                status: 'eligible',
                data_provider_id: providerId,
                data_provider: source,
                date_basis: source === 'opendota' ? 'observed' : 'official',
                tier: tournament.tier || existing.tier,
                start_date: startDateString,
                end_date: endDateString,
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', existing.id);

            if (error) throw error;
            if (previousIdentity) {
              removeTournamentIndexEntry(existingTournaments.byIdentity, previousIdentity, existing);
            }
            Object.assign(existing, {
              name: tournament.name,
              data_provider_id: providerId,
              data_provider: source,
              date_basis: source === 'opendota' ? 'observed' : 'official',
              start_date: startDateString,
              end_date: endDateString,
            });
            addTournamentIndexEntry(existingTournaments.byProviderId, `${source}:${providerId}`, existing);
            addTournamentIndexEntry(
              existingTournaments.byIdentity,
              tournamentIdentity(existing.name, new Date(existing.start_date)),
              existing,
            );
            result.updated++;
          } else {
            // Create new tournament
            // Get or create a default season first
            let { data: season } = await supabase
              .from('seasons')
              .select('id')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!season) {
              const currentYear = new Date().getFullYear();
              const { data: newSeason, error: seasonError } = await supabase
                .from('seasons')
                .insert({
                  name: `Season ${currentYear}`,
                  slug: `season-${currentYear}`,
                  status: 'active',
                  start_date: `${currentYear}-01-01`,
                  end_date: `${currentYear}-12-31`,
                  starting_budget: 45.0,
                  max_players_per_team: 3,
                  squad_size: 5,
                  starters_required: 5,
                  bench_size: 0,
                })
                .select('id')
                .single();

              if (!seasonError && newSeason) {
                season = newSeason;
              }
            }

            const seasonId = season?.id || 1;
            const slug = `${source}-${tournament.id}-${tournament.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;

            // Use upsert on (season_id, slug) so reruns never crash on duplicates.
            // If the row already exists (same season + slug) it updates name/tier/sync time.
            const { data: insertedTournament, error } = await supabase
              .from('tournaments')
              .upsert(
                {
                  season_id: seasonId,
                  name: tournament.name,
                  slug,
                  data_provider_id: String(tournament.id),
                  data_provider: source,
                  date_basis: source === 'opendota' ? 'observed' : 'official',
                  status: 'provisional',
                  tier: tournament.tier || 'Professional',
                  start_date: startDateString,
                  end_date: endDateString,
                  eligible: true,
                  last_synced_at: new Date().toISOString(),
                },
                { onConflict: 'season_id,slug' }
              )
              .select('*')
              .single();

            if (error) throw error;
            const inserted = insertedTournament as Tournament;
            addTournamentIndexEntry(
              existingTournaments.byProviderId,
              `${source}:${providerId}`,
              inserted,
            );
            addTournamentIndexEntry(
              existingTournaments.byIdentity,
              tournamentIdentity(inserted.name, new Date(inserted.start_date)),
              inserted,
            );
            result.discovered++;
            console.log(`[discoverTournaments] Discovered new tournament: ${tournament.name}`);
          }
        } catch (error) {
          result.errors.push(
            `Failed to process tournament ${tournament.id}: ${(error as Error).message}`
          );
        }
      }

      await logJobExecution('discover-tournaments', result.errors.length > 0 ? 'failed' : 'completed', {
        discovered: result.discovered,
        updated: result.updated,
        errors: result.errors.length,
        error_details: result.errors,
      }, jobExecutionId);

      if (result.errors.length > 0) {
        console.error('[discoverTournaments] Completed with errors:', result.errors);
      } else {
        console.log('[discoverTournaments] Completed successfully');
      }
    } catch (error) {
      await logJobExecution('discover-tournaments', 'failed', {
        error: (error as Error).message,
      }, jobExecutionId);
      throw error;
    }
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error('[discoverTournaments] Failed:', errorMsg);
    result.errors.push(errorMsg);
  }

  result.completedAt = new Date();
  result.duration = result.completedAt.getTime() - result.startedAt.getTime();

  return result;
}

type TournamentProvider = 'stratz' | 'opendota';

function tournamentIdentity(name: string, startDate: Date): string {
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `name:${normalizedName}:${startDate.getUTCFullYear()}`;
}

interface ExistingTournamentIndex {
  byProviderId: Map<string, Tournament[]>;
  byIdentity: Map<string, Tournament[]>;
}

function findExistingTournament(
  existingTournaments: ExistingTournamentIndex,
  source: TournamentProvider,
  providerId: string,
  tournament: TournamentData
): { tournament: Tournament | null; ambiguous: boolean } {
  const providerMatches = existingTournaments.byProviderId.get(`${source}:${providerId}`) ?? [];
  if (providerMatches.length > 1) return { tournament: null, ambiguous: true };
  if (providerMatches.length === 1) return { tournament: providerMatches[0], ambiguous: false };

  const identityMatches = existingTournaments.byIdentity.get(tournamentIdentity(tournament.name, tournament.startDate)) ?? [];
  if (identityMatches.length > 1) return { tournament: null, ambiguous: true };
  return { tournament: identityMatches[0] ?? null, ambiguous: false };
}

function validDate(value: Date, field: string, tournament: TournamentData): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Provider returned an invalid ${field} for tournament ${tournament.id} (${tournament.name})`);
  }
  return date;
}

function addTournamentIndexEntry(
  index: Map<string, Tournament[]>,
  key: string,
  tournament: Tournament
): void {
  const matches = index.get(key) ?? [];
  if (!matches.some((match) => match.id === tournament.id)) matches.push(tournament);
  index.set(key, matches);
}

function removeTournamentIndexEntry(
  index: Map<string, Tournament[]>,
  key: string,
  tournament: Tournament,
): void {
  const matches = index.get(key);
  if (!matches) return;
  const remainingMatches = matches.filter((match) => match.id !== tournament.id);
  if (remainingMatches.length === 0) index.delete(key);
  else index.set(key, remainingMatches);
}

async function getExistingTournaments(): Promise<ExistingTournamentIndex> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('tournaments')
    .select('*');

  if (error) {
    throw new Error(`Failed to fetch existing tournaments: ${error.message}`);
  }

  const tournamentMap: ExistingTournamentIndex = {
    byProviderId: new Map(),
    byIdentity: new Map(),
  };
  for (const tournament of data || []) {
    if (tournament.data_provider_id) {
      addTournamentIndexEntry(
        tournamentMap.byProviderId,
        `${tournament.data_provider ?? 'stratz'}:${tournament.data_provider_id}`,
        tournament,
      );
    }
    if (tournament.name && tournament.start_date) {
      addTournamentIndexEntry(
        tournamentMap.byIdentity,
        tournamentIdentity(tournament.name, new Date(tournament.start_date)),
        tournament
      );
    }
  }

  return tournamentMap;
}

async function logJobExecution(
  jobName: string,
  status: 'started' | 'completed' | 'failed',
  metadata?: Record<string, unknown>,
  executionId?: string
): Promise<string> {
  const supabase = getSupabaseServerClient();

  if (executionId) {
    const { error } = await supabase
      .from('job_execution_log')
      .update({
        status,
        completed_at: new Date().toISOString(),
        metadata,
      })
      .eq('id', executionId);

    if (error) {
      console.warn(`Failed to update job execution log: ${error.message}`);
    }

    return executionId;
  } else {
    const { data, error } = await supabase
      .from('job_execution_log')
      .insert({
        job_name: jobName,
        status,
        started_at: new Date().toISOString(),
        metadata,
      })
      .select('id')
      .single();

    if (error) {
      console.warn(`Failed to create job execution log: ${error.message}`);
      return `job-${Date.now()}`;
    }

    return data?.id || `job-${Date.now()}`;
  }
}

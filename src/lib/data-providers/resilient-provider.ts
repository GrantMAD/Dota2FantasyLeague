import type {
  DataProvider,
  DataProviderFilters,
  MatchData,
  MatchDetailsData,
  PlayerData,
  RosterChangeData,
  TeamData,
  TournamentData,
} from './provider-interface';

const FAILURE_THRESHOLD = 2;
const CIRCUIT_COOLDOWN_MS = 30_000;

interface ProviderCircuit {
  failures: number;
  openUntil: number;
}

type ProviderOperation<T> = (provider: DataProvider) => Promise<T>;

export class ResilientDataProvider implements DataProvider {
  readonly name: string;
  readonly version: string;

  private readonly circuits = new Map<DataProvider, ProviderCircuit>();

  constructor(
    private readonly primary: DataProvider,
    private readonly fallback: DataProvider | undefined,
    primaryInitiallyHealthy = true
  ) {
    this.name = primary.name;
    this.version = primary.version;
    this.circuits.set(primary, {
      failures: primaryInitiallyHealthy ? 0 : FAILURE_THRESHOLD,
      openUntil: primaryInitiallyHealthy ? 0 : Date.now() + CIRCUIT_COOLDOWN_MS,
    });
    if (fallback) this.circuits.set(fallback, { failures: 0, openUntil: 0 });
  }

  async healthCheck(): Promise<boolean> {
    const primaryHealthy = await this.checkHealth(this.primary);
    if (primaryHealthy) this.recordSuccess(this.primary);
    else this.recordFailure(this.primary);

    if (primaryHealthy) return true;
    if (!this.fallback) return false;

    const fallbackHealthy = await this.checkHealth(this.fallback);
    if (fallbackHealthy) this.recordSuccess(this.fallback);
    else this.recordFailure(this.fallback);
    return fallbackHealthy;
  }

  fetchPlayers(filters?: DataProviderFilters): Promise<PlayerData[]> {
    return this.execute('fetchPlayers', (provider) => provider.fetchPlayers(filters));
  }

  fetchPlayer(playerId: string): Promise<PlayerData> {
    return this.execute('fetchPlayer', (provider) => provider.fetchPlayer(playerId));
  }

  fetchTeams(filters?: DataProviderFilters): Promise<TeamData[]> {
    return this.execute('fetchTeams', (provider) => provider.fetchTeams(filters));
  }

  fetchTeam(teamId: string): Promise<TeamData> {
    return this.execute('fetchTeam', (provider) => provider.fetchTeam(teamId));
  }

  fetchTournaments(
    filters?: DataProviderFilters & { status?: 'upcoming' | 'active' | 'concluded'; minTier?: string }
  ): Promise<TournamentData[]> {
    return this.execute('fetchTournaments', (provider) => provider.fetchTournaments(filters));
  }

  fetchMatches(
    tournamentId?: string,
    filters?: DataProviderFilters & { status?: 'scheduled' | 'live' | 'concluded' }
  ): Promise<MatchData[]> {
    return this.execute('fetchMatches', (provider) => provider.fetchMatches(tournamentId, filters));
  }

  fetchMatchDetails(matchId: string): Promise<MatchDetailsData> {
    return this.execute('fetchMatchDetails', (provider) => provider.fetchMatchDetails(matchId));
  }

  fetchRosterHistory(
    playerId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<RosterChangeData[]> {
    return this.execute('fetchRosterHistory', (provider) => provider.fetchRosterHistory(playerId, dateRange));
  }

  async getRateLimitStatus(): Promise<{
    remaining: number;
    limit: number;
    resetAt: Date;
  }> {
    return this.execute('getRateLimitStatus', (provider) => provider.getRateLimitStatus());
  }

  private async execute<T>(operation: string, request: ProviderOperation<T>): Promise<T> {
    const primaryCircuit = this.getCircuit(this.primary);

    if (Date.now() < primaryCircuit.openUntil) {
      console.warn(`[DataProvider] Primary ${this.primary.name} circuit is open; trying ${this.fallback?.name ?? 'no fallback'} for ${operation}`);
      return this.useFallback(operation, request, new Error('Primary provider circuit is open'));
    }

    try {
      const result = await request(this.primary);
      this.recordSuccess(this.primary);
      return result;
    } catch (primaryError) {
      this.recordFailure(this.primary);
      console.warn(
        `[DataProvider] ${this.primary.name} failed during ${operation}; trying ${this.fallback?.name ?? 'no fallback'}`,
        primaryError
      );
      if (!this.fallback) {
        throw new Error(
          `All configured data providers failed during ${operation}. ${this.primary.name}: ${this.describeError(primaryError)}`
        );
      }
      return this.useFallback(operation, request, primaryError);
    }
  }

  private async useFallback<T>(
    operation: string,
    request: ProviderOperation<T>,
    primaryError: unknown
  ): Promise<T> {
    if (!this.fallback) {
      throw new Error(
        `All configured data providers failed during ${operation}. Primary: ${this.describeError(primaryError)}`
      );
    }

    try {
      const fallbackCircuit = this.getCircuit(this.fallback);
      const fallbackHealthy = await this.checkHealth(this.fallback);
      if (!fallbackHealthy) {
        throw new Error(`${this.fallback.name} health check failed`);
      }
      if (Date.now() < fallbackCircuit.openUntil) this.recordSuccess(this.fallback);
      const result = await request(this.fallback);
      this.recordSuccess(this.fallback);
      console.info(`[DataProvider] ${operation} succeeded using fallback ${this.fallback.name}`);
      return result;
    } catch (fallbackError) {
      this.recordFailure(this.fallback);
      throw new Error(
        `All configured data providers failed during ${operation}. ` +
        `${this.primary.name}: ${this.describeError(primaryError)}; ` +
        `${this.fallback.name}: ${this.describeError(fallbackError)}`
      );
    }
  }

  private async checkHealth(provider: DataProvider): Promise<boolean> {
    try {
      return await provider.healthCheck();
    } catch {
      return false;
    }
  }

  private getCircuit(provider: DataProvider): ProviderCircuit {
    const circuit = this.circuits.get(provider);
    if (!circuit) throw new Error(`No circuit state registered for provider ${provider.name}`);
    return circuit;
  }

  private recordSuccess(provider: DataProvider): void {
    const circuit = this.getCircuit(provider);
    circuit.failures = 0;
    circuit.openUntil = 0;
  }

  private recordFailure(provider: DataProvider): void {
    const circuit = this.getCircuit(provider);
    circuit.failures += 1;
    if (circuit.failures >= FAILURE_THRESHOLD) {
      circuit.openUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    }
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

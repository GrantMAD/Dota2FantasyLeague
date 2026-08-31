/**
 * Integration Test Helpers
 * Utilities for testing full data flow from provider through database
 */

/**
 * In-memory database for testing
 * Simulates Supabase tables for integration testing
 */
export class TestDatabase {
  private tables: Map<string, unknown[]> = new Map();

  constructor() {
    // Initialize tables
    this.tables.set('professional_players', []);
    this.tables.set('professional_teams', []);
    this.tables.set('tournaments', []);
    this.tables.set('matches', []);
    this.tables.set('match_player_stats', []);
    this.tables.set('team_roster_history', []);
    this.tables.set('job_execution_log', []);
  }

  /**
   * Get all records from a table
   */
  getTable<T>(tableName: string): T[] {
    return (this.tables.get(tableName) || []) as T[];
  }

  /**
   * Insert records into a table
   */
  insert<T>(tableName: string, records: T[]): { error: null | Error } {
    const table = this.getTable<T>(tableName);
    table.push(...records);
    this.tables.set(tableName, table);
    return { error: null };
  }

  /**
   * Update records in a table
   */
  update<T>(
    tableName: string,
    updates: Partial<T>,
    condition: (record: T) => boolean
  ): { error: null | Error } {
    const table = this.getTable<T>(tableName);
    const updated = table.map((record) => (condition(record) ? { ...record, ...updates } : record));
    this.tables.set(tableName, updated);
    return { error: null };
  }

  /**
   * Query records from a table
   */
  query<T>(tableName: string, condition?: (record: T) => boolean): T[] {
    const table = this.getTable<T>(tableName);
    return condition ? table.filter(condition) : table;
  }

  /**
   * Clear a table
   */
  clearTable(tableName: string): void {
    this.tables.set(tableName, []);
  }

  /**
   * Clear all tables
   */
  clearAll(): void {
    this.tables.forEach((_, key) => {
      this.tables.set(key, []);
    });
  }

  /**
   * Get table stats
   */
  getStats(tableName: string): { count: number; table: string } {
    const table = this.getTable(tableName);
    return { table: tableName, count: table.length };
  }
}

/**
 * Mock Supabase client factory for testing
 */
export function createMockSupabaseClient(db: TestDatabase) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: (field: string, value: unknown) => ({
          then: async (callback: (result: { data: unknown[] | null }) => void) => {
            const data = db.query(table, (record: Record<string, unknown>) => {
              return record[field] === value;
            });
            callback({ data });
          },
        }),
      }),
      insert: async (data: unknown) => {
        const result = db.insert(table, Array.isArray(data) ? data : [data]);
        return result;
      },
      update: async () => {
        // Simplified update - just tracks that update was called
        return { error: null };
      },
    }),
  };
}

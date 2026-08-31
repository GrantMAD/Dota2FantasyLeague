# Stage 9: Testing & Validation - Data Ingestion Jobs

## Overview

This directory contains comprehensive tests for the Phase 9 data ingestion framework, ensuring reliability and correctness of all job functions before production deployment.

## Test Structure

```
__tests__/
├── mock-provider.ts         # Mock data provider for testing without external APIs
├── test-database.ts         # In-memory test database for integration testing
├── sync-players.test.ts     # Unit tests for player sync job
├── integration.test.ts      # Full pipeline integration tests
└── README.md                # This file
```

## Components

### 1. Mock Data Provider (`mock-provider.ts`)

Provides realistic test data without calling external APIs:

- **MockDataProvider** - Implements the DataProvider interface
  - `fetchPlayers()` - Returns 3 test players (2 with teams, 1 without)
  - `fetchTeams()` - Returns 2 teams with roster data
  - `fetchTournaments()` - Returns 2 upcoming tournaments
  - `fetchMatches()` - Returns scheduled and concluded matches
  - `fetchMatchDetails()` - Returns detailed player statistics
  - `fetchRosterChanges()` - Returns roster change history

**Usage:**
```typescript
const provider = getMockProvider();
const players = await provider.fetchPlayers();
```

### 2. Test Database (`test-database.ts`)

In-memory database for simulating Supabase operations:

- **TestDatabase** - Simulates PostgreSQL tables
  - `insert()` - Add records to tables
  - `update()` - Update records with conditions
  - `query()` - Retrieve records with optional filtering
  - `getTable()` - Get all records from a table
  - `clearTable()` / `clearAll()` - Reset data

**Usage:**
```typescript
const db = new TestDatabase();
const client = createMockSupabaseClient(db);
await client.from('professional_players').insert(records);
const stored = db.getTable('professional_players');
```

### 3. Unit Tests (`sync-players.test.ts`)

Tests individual job functions in isolation:

- ✅ Fetching players from provider
- ✅ Validating player data structure
- ✅ Handling players without teams
- ✅ Tracking availability status

**Run:**
```bash
npm test -- sync-players.test.ts
```

### 4. Integration Tests (`integration.test.ts`)

Tests full data flow from provider through database:

#### Player Sync Pipeline
- ✅ Fetch players → Insert into database
- ✅ Handle deduplication on re-runs
- ✅ Update existing player records

#### Team & Roster Pipeline
- ✅ Fetch teams → Insert into database
- ✅ Link players to teams via roster data
- ✅ Track roster changes

#### Tournament & Match Discovery
- ✅ Discover tournaments
- ✅ Fetch matches for each tournament
- ✅ Handle tournament status transitions

#### Match Details Pipeline
- ✅ Fetch detailed match statistics
- ✅ Calculate fantasy scores
- ✅ Validate player performance metrics

#### Roster Change Tracking
- ✅ Track player transfers
- ✅ Update team assignments
- ✅ Update availability status

#### Job Execution Logging
- ✅ Log job starts and completions
- ✅ Track execution metadata
- ✅ Record error information

**Run:**
```bash
npm test -- integration.test.ts
```

## Running Tests

### All Tests
```bash
npm test -- jest.config.jobs.js
```

### Specific Test File
```bash
npm test -- sync-players.test.ts
npm test -- integration.test.ts
```

### With Coverage
```bash
npm test -- jest.config.jobs.js --coverage
```

### Watch Mode
```bash
npm test -- jest.config.jobs.js --watch
```

## Test Data Flow

### Complete Integration Test Flow

```
MockDataProvider
    ↓
fetchPlayers() → PlayerData[]
    ↓
Transform to DB format
    ↓
supabase.from('professional_players').insert()
    ↓
TestDatabase stores records
    ↓
Verify via db.getTable()
```

### End-to-End Data Pipeline

```
1. Player Sync
   - Fetch players from STRATZ/OpenDota via mock provider
   - Deduplicate by data_provider_id
   - Insert new players
   - Update existing players

2. Team & Roster Sync
   - Fetch teams with roster data
   - Insert new teams
   - Link players to teams
   - Track roster changes

3. Tournament Discovery
   - Fetch upcoming tournaments
   - Insert new tournaments
   - Mark active tournament for current gameweek

4. Match Fetching
   - Fetch scheduled matches
   - Insert match records
   - Queue concluded matches for detail fetching

5. Match Details & Scoring
   - Fetch player statistics
   - Calculate fantasy points per player
   - Insert into match_player_stats
   - Insert into gameweek_scores
   - Update match.detailed_stats_fetched_at

6. Roster Tracking
   - Detect roster changes
   - Insert into team_roster_history
   - Update player availability_status
```

## Coverage Goals

| Component | Target | Status |
|-----------|--------|--------|
| sync-players | 80%+ | 🟡 In Progress |
| sync-teams | 80%+ | 🟡 In Progress |
| discover-tournaments | 80%+ | 🟡 In Progress |
| fetch-matches | 80%+ | 🟡 In Progress |
| fetch-match-details | 80%+ | 🟡 In Progress |
| track-roster-changes | 80%+ | 🟡 In Progress |
| job-execution-log | 90%+ | ✅ Complete |
| Data Provider Interface | 85%+ | ✅ Complete |

## Adding New Tests

1. **Create test file** in `__tests__/` directory with `.test.ts` extension
2. **Import test utilities**:
   ```typescript
   import { getMockProvider } from './mock-provider';
   import { TestDatabase, createMockSupabaseClient } from './test-database';
   ```
3. **Write test cases** following Jest conventions
4. **Run tests** to verify

Example:
```typescript
describe('My Job', () => {
  let testDb: TestDatabase;

  beforeEach(() => {
    testDb = new TestDatabase();
  });

  test('should do something', async () => {
    const provider = getMockProvider();
    const supabase = createMockSupabaseClient(testDb);

    // Test logic here
    expect(result).toBeDefined();
  });
});
```

## Known Limitations

1. **Mock Database** - Simplified in-memory implementation:
   - No referential integrity checks
   - No complex query filtering
   - No transaction support
   - For real testing, consider Supabase test database

2. **Mock Provider** - Fixed test data:
   - Same data returned each time
   - No randomization
   - Limited edge cases
   - Real provider may return different data structures

3. **Jest Configuration** - Node environment:
   - Does not test browser functionality
   - No DOM available
   - API routes tested separately

## Future Enhancements

- [ ] Add E2E tests using Supabase test database
- [ ] Add performance benchmarks for data pipeline
- [ ] Add stress tests with large datasets
- [ ] Add chaos engineering tests (network failures, timeouts)
- [ ] Add data validation and quality checks
- [ ] Add regression tests for bug fixes

## Troubleshooting

### Tests not running
- Ensure Jest is installed: `npm install --save-dev jest @types/jest ts-jest`
- Check `jest.config.jobs.js` is in project root
- Verify test files match pattern: `**/__tests__/**/*.test.ts`

### Mock provider not working
- Check `__tests__/mock-provider.ts` exists and exports `getMockProvider`
- Verify interface implementation matches `DataProvider` type

### Database test failures
- Ensure `TestDatabase` is instantiated in `beforeEach`
- Clear data between tests with `testDb.clearAll()`
- Check table names match exactly

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [Supabase Testing](https://supabase.com/docs/guides/testing)
- [Data Provider Interface](../types/data-provider.ts)
- [Job Implementations](../)

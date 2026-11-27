import { overrideEntityData, rollbackToVersion } from './admin-utils';
import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import { logAuditAction } from '@/lib/audit-logger';

jest.mock('@/lib/db/supabase-server', () => ({
  getSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/audit-logger', () => ({
  logAuditAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/auth-utils', () => ({
  verifyAdminAuth: jest.fn(),
}));

const mockedGetSupabase = getSupabaseServerClient as jest.Mock;
const mockedLogAuditAction = logAuditAction as jest.Mock;

function createVersionedSupabaseMock(options: {
  entityRow: Record<string, unknown> | null;
  latestVersion?: number | null;
  targetRollbackPreviousValues?: Record<string, unknown> | null;
  entityUpdateError?: { message: string } | null;
  versionInsertError?: { message: string } | null;
}) {
  const entityUpdates: Array<{ table: string; payload: Record<string, unknown>; id: string }> = [];
  const versionInserts: Array<Record<string, unknown>> = [];

  const client = {
    from: jest.fn((table: string) => {
      if (table === 'data_version_history') {
        return {
          select: jest.fn((columns: string) => {
            const filters: Record<string, unknown> = {};
            const chain: {
              eq: jest.Mock;
              order: jest.Mock;
              limit: jest.Mock;
              maybeSingle: jest.Mock;
              single: jest.Mock;
            } = {
              eq: jest.fn((col: string, val: unknown) => {
                filters[col] = val;
                return chain;
              }),
              order: jest.fn(() => chain),
              limit: jest.fn(() => chain),
              maybeSingle: jest.fn(async () => ({
                data: options.latestVersion != null ? { version_number: options.latestVersion } : null,
                error: null,
              })),
              single: jest.fn(async () => {
                if (columns === 'previous_values' && options.targetRollbackPreviousValues !== undefined) {
                  return options.targetRollbackPreviousValues === null
                    ? { data: null, error: { message: 'Not found' } }
                    : { data: { previous_values: options.targetRollbackPreviousValues }, error: null };
                }
                return { data: null, error: { message: 'Not found' } };
              }),
            };
            return chain;
          }),
          insert: jest.fn(async (payload: Record<string, unknown>) => {
            versionInserts.push(payload);
            return { error: options.versionInsertError ?? null };
          }),
        };
      }

      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({
              data: options.entityRow,
              error: null,
            })),
          })),
        })),
        update: jest.fn((payload: Record<string, unknown>) => ({
          eq: jest.fn(async (_col: string, id: string) => {
            entityUpdates.push({ table, payload, id });
            return { error: options.entityUpdateError ?? null };
          }),
        })),
      };
    }),
  };

  return { client, entityUpdates, versionInserts };
}

describe('overrideEntityData and rollbackToVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches current entity values, increments version_number, updates the entity, and logs audit history', async () => {
    const { client, entityUpdates, versionInserts } = createVersionedSupabaseMock({
      entityRow: { name: 'Old Name', country: 'SE', tier: 1 },
      latestVersion: 4,
    });
    mockedGetSupabase.mockReturnValue(client);

    const result = await overrideEntityData(
      'player',
      '42',
      { name: 'New Name', country: 'SE', tier: 2, id: 'ignored' },
      'admin-1',
      'Fix typo and tier'
    );

    expect(result).toEqual({ success: true, versionNumber: 5 });
    expect(entityUpdates).toHaveLength(1);
    expect(entityUpdates[0].table).toBe('professional_players');
    expect(entityUpdates[0].id).toBe('42');
    expect(entityUpdates[0].payload).toMatchObject({ name: 'New Name', tier: 2 });
    expect(entityUpdates[0].payload).not.toHaveProperty('country');
    expect(entityUpdates[0].payload).not.toHaveProperty('id');

    expect(versionInserts).toHaveLength(1);
    expect(versionInserts[0]).toMatchObject({
      entity_type: 'player',
      entity_id: '42',
      version_number: 5,
      previous_values: { name: 'Old Name', tier: 1 },
      new_values: { name: 'New Name', tier: 2 },
      changed_fields: ['name', 'tier'],
      change_reason: 'Fix typo and tier',
      changed_by_user: 'admin-1',
      change_source: 'manual_override',
      is_approved: true,
    });

    expect(mockedLogAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'professional_players',
        recordId: 42,
        action: 'CORRECTION',
        changedBy: 'admin-1',
        oldValues: { name: 'Old Name', tier: 1 },
        newValues: { name: 'New Name', tier: 2 },
      })
    );
  });

  it('starts at version 1 when no previous versions exist and skips empty diffs cleanly', async () => {
    const { client, entityUpdates, versionInserts } = createVersionedSupabaseMock({
      entityRow: { name: 'Team Spirit' },
      latestVersion: null,
    });
    mockedGetSupabase.mockReturnValue(client);

    const noOpResult = await overrideEntityData(
      'team',
      '7',
      { name: 'Team Spirit' },
      'admin-1',
      'No-op check'
    );
    expect(noOpResult).toEqual({ success: true });
    expect(entityUpdates).toHaveLength(0);
    expect(versionInserts).toHaveLength(0);

    const createV1Result = await overrideEntityData(
      'team',
      '7',
      { name: 'Spirit' },
      'admin-1',
      'Rename'
    );
    expect(createV1Result).toEqual({ success: true, versionNumber: 1 });
    expect(versionInserts[0].version_number).toBe(1);
    expect(versionInserts[0].previous_values).toEqual({ name: 'Team Spirit' });
  });

  it('fails without inserting version history when entity is missing or update fails', async () => {
    const missingMock = createVersionedSupabaseMock({
      entityRow: null,
      latestVersion: 2,
    });
    mockedGetSupabase.mockReturnValue(missingMock.client);

    const missingResult = await overrideEntityData('match', '999', { status: 'completed' }, 'admin-1', 'Fix');
    expect(missingResult).toEqual({ success: false, error: 'match 999 not found' });
    expect(missingMock.versionInserts).toHaveLength(0);

    const errorMock = createVersionedSupabaseMock({
      entityRow: { status: 'scheduled' },
      latestVersion: 2,
      entityUpdateError: { message: 'invalid column' },
    });
    mockedGetSupabase.mockReturnValue(errorMock.client);

    const updateErrorResult = await overrideEntityData('match', '12', { status: 'completed' }, 'admin-1', 'Fix');
    expect(updateErrorResult).toEqual({ success: false, error: 'invalid column' });
    expect(errorMock.versionInserts).toHaveLength(0);
  });

  it('rolls back using latest version_number + 1, captures current values, and updates the entity', async () => {
    const { client, entityUpdates, versionInserts } = createVersionedSupabaseMock({
      entityRow: { name: 'Wrong Name', tier: 3 },
      latestVersion: 5,
      targetRollbackPreviousValues: { name: 'Original Name', tier: 1 },
    });
    mockedGetSupabase.mockReturnValue(client);

    const result = await rollbackToVersion('tournament', '10', 2, 'admin-1', 'Revert bad edit');

    expect(result).toEqual({ success: true, versionNumber: 6 });
    expect(entityUpdates).toHaveLength(1);
    expect(entityUpdates[0].table).toBe('tournaments');
    expect(entityUpdates[0].payload).toMatchObject({ name: 'Original Name', tier: 1 });

    expect(versionInserts[0]).toMatchObject({
      entity_type: 'tournament',
      entity_id: '10',
      version_number: 6,
      previous_values: { name: 'Wrong Name', tier: 3 },
      new_values: { name: 'Original Name', tier: 1 },
      changed_fields: ['name', 'tier'],
      change_reason: 'Rollback to version 2: Revert bad edit',
    });
  });

  it('rejects rollback when the target version has empty previous_values', async () => {
    const { client, entityUpdates, versionInserts } = createVersionedSupabaseMock({
      entityRow: { name: 'Current' },
      latestVersion: 3,
      targetRollbackPreviousValues: {},
    });
    mockedGetSupabase.mockReturnValue(client);

    const result = await rollbackToVersion('player', '4', 1, 'admin-1', 'Revert');
    expect(result).toEqual({
      success: false,
      error: 'Target version has no previous values to restore',
    });
    expect(entityUpdates).toHaveLength(0);
    expect(versionInserts).toHaveLength(0);
  });
});

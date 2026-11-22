import { resolveDuplicateAndStaleLiveMatches } from '../fetch-matches';

describe('resolveDuplicateAndStaleLiveMatches', () => {
  it('purges an aborted in_progress lobby when a newer completed match exists in the same series', async () => {
    const mockMatches = [
      {
        id: 585,
        series_id: 513,
        status: 'in_progress',
        scheduled_time: '2026-11-21T20:46:00',
        start_time: '2026-11-21T20:46:00',
        external_match_id: '9100153440',
        detailed_stats_fetched_at: null,
        duration_minutes: null,
      },
      {
        id: 586,
        series_id: 513,
        status: 'completed',
        scheduled_time: '2026-11-21T22:34:48',
        start_time: '2026-11-21T22:34:48',
        external_match_id: '9100301435',
        detailed_stats_fetched_at: '2026-11-21T23:42:20',
        duration_minutes: 27,
      },
    ];

    const deletedIds: number[] = [];

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'matches') {
          return {
            select: jest.fn((cols: string) => {
              return {
                eq: jest.fn((col: string, val: unknown) => {
                  if (col === 'status' && val === 'in_progress') {
                    return Promise.resolve({ data: [mockMatches[0]], error: null });
                  }
                  if (col === 'series_id') {
                    return {
                      order: jest.fn(() => Promise.resolve({ data: mockMatches, error: null })),
                    };
                  }
                  if (col === 'id') {
                    const match = mockMatches.find((m) => m.id === val);
                    return {
                      single: jest.fn(() => Promise.resolve({ data: match, error: null })),
                    };
                  }
                  return Promise.resolve({ data: [], error: null });
                }),
              };
            }),
            delete: jest.fn(() => ({
              eq: jest.fn((col: string, val: number) => {
                deletedIds.push(val);
                return Promise.resolve({ error: null });
              }),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ error: null })),
            })),
          };
        }
        if (table === 'match_player_stats') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ count: 0, error: null })),
            })),
          };
        }
        return {};
      }),
    } as any;

    const result = await resolveDuplicateAndStaleLiveMatches(mockSupabase);

    expect(result.purgedAborted).toBe(1);
    expect(deletedIds).toContain(585);
  });

  it('marks older match completed if it has stats rather than purging', async () => {
    const mockMatches = [
      {
        id: 584,
        series_id: 513,
        status: 'in_progress', // stuck as in_progress but has stats
        scheduled_time: '2026-11-21T19:14:55',
        external_match_id: '9100047324',
        detailed_stats_fetched_at: '2026-11-21T20:15:00',
        duration_minutes: 46,
      },
      {
        id: 586,
        series_id: 513,
        status: 'completed',
        scheduled_time: '2026-11-21T22:34:48',
        external_match_id: '9100301435',
        detailed_stats_fetched_at: '2026-11-21T23:42:20',
        duration_minutes: 27,
      },
    ];

    const updatedMatches: Array<{ id: number; status: string }> = [];

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'matches') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn((col: string, val: unknown) => {
                if (col === 'status' && val === 'in_progress') {
                  return Promise.resolve({ data: [mockMatches[0]], error: null });
                }
                if (col === 'series_id') {
                  return {
                    order: jest.fn(() => Promise.resolve({ data: mockMatches, error: null })),
                  };
                }
                return Promise.resolve({ data: [], error: null });
              }),
            })),
            delete: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ error: null })),
            })),
            update: jest.fn((payload: any) => ({
              eq: jest.fn((_col: string, val: number) => {
                updatedMatches.push({ id: val, status: payload.status });
                return Promise.resolve({ error: null });
              }),
            })),
          };
        }
        return {};
      }),
    } as any;

    const result = await resolveDuplicateAndStaleLiveMatches(mockSupabase);

    expect(result.resolvedCompleted).toBe(1);
    expect(updatedMatches).toEqual([{ id: 584, status: 'completed' }]);
  });
});

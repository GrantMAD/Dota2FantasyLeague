import { buildDurableJobHealth, getExpectedJobIntervalMs } from '../durable-job-health';

describe('durable job health', () => {
  const now = Date.parse('2026-10-06T12:00:00.000Z');

  it('distinguishes unknown health from healthy when enabled jobs have no durable runs', () => {
    const health = buildDurableJobHealth([
      { name: 'sync', schedule: '0 3 * * *', enabled: true },
    ], [], now);

    expect(health.status).toBe('unknown');
    expect(health.healthy).toBeNull();
    expect(health.unknownJobs).toEqual(['sync']);
  });

  it('reports failed, stale, and running states from persisted runs', () => {
    const health = buildDurableJobHealth([
      { name: 'failed', schedule: '*/10 * * * *', enabled: true },
      { name: 'stale', schedule: '0 * * * *', enabled: true },
      { name: 'running', schedule: '*/5 * * * *', enabled: true },
      { name: 'disabled', schedule: '*/5 * * * *', enabled: false },
    ], [
      { job_name: 'failed', status: 'failed', started_at: new Date(now - MINUTE).toISOString(), completed_at: new Date(now).toISOString(), error_message: 'boom' },
      { job_name: 'stale', status: 'completed', started_at: new Date(now - 4 * HOUR).toISOString(), completed_at: new Date(now - 4 * HOUR).toISOString(), error_message: null },
      { job_name: 'running', status: 'running', started_at: new Date(now - HOUR).toISOString(), completed_at: null, error_message: null },
    ], now);

    expect(health.status).toBe('degraded');
    expect(health.healthy).toBe(false);
    expect(health.failedJobs).toEqual(['failed']);
    expect(health.staleJobs).toEqual(expect.arrayContaining(['stale', 'running']));
    expect(health.runningJobs).toEqual(['running']);
    expect(health.unknownJobs).toEqual([]);
  });

  it('does not treat skipped executions as successful job activity', () => {
    const health = buildDurableJobHealth([
      { name: 'skipped', schedule: '*/10 * * * *', enabled: true },
    ], [
      { job_name: 'skipped', status: 'skipped', started_at: new Date(now).toISOString(), completed_at: new Date(now).toISOString(), error_message: null },
    ], now);

    expect(health.status).toBe('unknown');
    expect(health.healthy).toBeNull();
    expect(health.unknownJobs).toEqual(['skipped']);
  });

  it('uses schedule-aware freshness thresholds for supported cron cadences', () => {
    expect(getExpectedJobIntervalMs('*/10 * * * *')).toBe(10 * MINUTE);
    expect(getExpectedJobIntervalMs('0 */6 * * *')).toBe(6 * HOUR);
    expect(getExpectedJobIntervalMs('0 3 * * *')).toBe(DAY);
    expect(getExpectedJobIntervalMs('0 4 * * 0')).toBe(7 * DAY);
  });
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

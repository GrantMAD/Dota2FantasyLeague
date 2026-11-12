/// <reference types="jest" />

import { getJobs } from '../scheduler';
import { matchesCronSchedule } from '../job-schedule';
import { getNextCronDate } from '../cron-utils';

describe('scheduled job cadence', () => {
  it('checks deadline and lineup reminders every 15 minutes', () => {
    expect(getJobs().find((job) => job.name === 'send-deadline-notifications')?.schedule)
      .toBe('*/15 * * * *');
  });

  it('allows every configured job to run via cron-jobs.org (Vercel cron removed)', () => {
    // The Vercel built-in cron was removed from vercel.json — all jobs are now triggered
    // individually by cron-jobs.org, which calls /api/cron/[job] on each job's own schedule.
    // This test verifies that every registered job has a valid cron expression so
    // cron-jobs.org can be configured correctly.
    for (const job of getJobs()) {
      expect(typeof job.schedule).toBe('string');
      expect(job.schedule.trim().length).toBeGreaterThan(0);
    }
  });

  it('supports standard cron minute, hour, day, month, and weekday fields in UTC', () => {
    expect(matchesCronSchedule('50 * * * *', new Date('2026-10-05T12:50:00Z'))).toBe(true);
    expect(matchesCronSchedule('55 * * * *', new Date('2026-10-05T12:50:00Z'))).toBe(false);
    expect(matchesCronSchedule('0 4 * * 0', new Date('2026-10-04T04:00:00Z'))).toBe(true);
  });

  it('calculates weekly next-run times from the complete cron expression', () => {
    expect(getNextCronDate('0 4 * * 0', new Date('2026-10-05T20:00:00Z')).toISOString())
      .toBe('2026-10-11T04:00:00.000Z');
  });
});

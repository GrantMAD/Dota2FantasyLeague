/// <reference types="jest" />

import vercelConfig from '../../../../vercel.json';
import { getJobs } from '../scheduler';
import { matchesCronSchedule } from '../job-schedule';
import { getNextCronDate } from '../cron-utils';

describe('scheduled job cadence', () => {
  it('allows every configured job to run on the deployed Vercel cadence', () => {
    const vercelSchedules = vercelConfig.crons.map((cron) => cron.schedule);
    const firstSlot = Date.UTC(2026, 9, 4, 0, 0);
    const slotCount = 8 * 24 * 12;

    for (const job of getJobs()) {
      const hasMatchingInvocation = Array.from({ length: slotCount }, (_, index) =>
        new Date(firstSlot + index * 5 * 60 * 1000)
      ).some((slot) =>
        vercelSchedules.some((schedule) => matchesCronSchedule(schedule, slot)) &&
        matchesCronSchedule(job.schedule, slot)
      );

      expect(hasMatchingInvocation).toBe(true);
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

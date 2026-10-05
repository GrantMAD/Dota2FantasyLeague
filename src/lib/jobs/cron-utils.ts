import { matchesCronSchedule } from './job-schedule';

const MAX_SEARCH_MINUTES = 366 * 24 * 60;

/** Calculate the next matching UTC minute for a standard five-field cron expression. */
export function getNextCronDate(cronExpression: string, fromDate: Date = new Date()): Date {
  const nextMinute = new Date(fromDate.getTime());
  nextMinute.setUTCSeconds(0, 0);
  nextMinute.setUTCMinutes(nextMinute.getUTCMinutes() + 1);

  for (let offset = 0; offset < MAX_SEARCH_MINUTES; offset += 1) {
    if (matchesCronSchedule(cronExpression, nextMinute)) {
      return nextMinute;
    }
    nextMinute.setUTCMinutes(nextMinute.getUTCMinutes() + 1);
  }

  throw new Error(`No next run found within one year for cron schedule: ${cronExpression}`);
}

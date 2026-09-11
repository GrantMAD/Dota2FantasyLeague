/**
 * Utility to calculate the next execution Date for standard 5-part cron expressions
 * format: minute hour dayOfMonth month dayOfWeek
 */
export function getNextCronDate(cronExpression: string, fromDate: Date = new Date()): Date {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 5) {
    return new Date(fromDate.getTime() + 60 * 60 * 1000);
  }

  const [minStr, hourStr] = parts;

  // Pattern: "*/N * * * *" -> Every N minutes
  if (minStr.startsWith('*/') && hourStr === '*') {
    const step = parseInt(minStr.replace('*/', ''), 10) || 5;
    const currentMins = fromDate.getUTCMinutes();
    const nextMins = Math.floor(currentMins / step) * step + step;
    const nextDate = new Date(fromDate.getTime());
    nextDate.setUTCSeconds(0, 0);
    nextDate.setUTCMinutes(nextMins);
    return nextDate;
  }

  // Pattern: "M */N * * *" -> Every N hours at minute M
  if (hourStr.startsWith('*/')) {
    const step = parseInt(hourStr.replace('*/', ''), 10) || 1;
    const targetMin = parseInt(minStr, 10) || 0;
    const nextDate = new Date(fromDate.getTime());
    nextDate.setUTCSeconds(0, 0);
    nextDate.setUTCMinutes(targetMin);

    const currentHour = fromDate.getUTCHours();
    const currentMin = fromDate.getUTCMinutes();

    let nextHour = Math.floor(currentHour / step) * step;
    if (nextHour < currentHour || (nextHour === currentHour && currentMin >= targetMin)) {
      nextHour += step;
    }
    nextDate.setUTCHours(nextHour);
    return nextDate;
  }

  // Pattern: "M * * * *" -> Hourly at minute M
  if (hourStr === '*' && !minStr.startsWith('*/')) {
    const targetMin = parseInt(minStr, 10) || 0;
    const nextDate = new Date(fromDate.getTime());
    nextDate.setUTCSeconds(0, 0);
    nextDate.setUTCMinutes(targetMin);
    if (fromDate.getUTCMinutes() >= targetMin) {
      nextDate.setUTCHours(nextDate.getUTCHours() + 1);
    }
    return nextDate;
  }

  // Pattern: "M H * * *" -> Daily at H:M UTC
  if (!hourStr.includes('*') && !minStr.includes('*')) {
    const targetHour = parseInt(hourStr, 10) || 0;
    const targetMin = parseInt(minStr, 10) || 0;
    const nextDate = new Date(fromDate.getTime());
    nextDate.setUTCSeconds(0, 0);
    nextDate.setUTCHours(targetHour, targetMin, 0, 0);
    if (nextDate.getTime() <= fromDate.getTime()) {
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    }
    return nextDate;
  }

  // Default fallback: 1 hour in the future
  return new Date(fromDate.getTime() + 60 * 60 * 1000);
}

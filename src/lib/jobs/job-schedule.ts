function matchesField(field: string, value: number, min: number, max: number): boolean {
  if (field === '*') return true;

  return field.split(',').some((part) => {
    const [rangeOrStart, stepText] = part.split('/');
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) {
      throw new Error(`Invalid cron step: ${part}`);
    }

    let start: number;
    let end: number;
    if (rangeOrStart === '*') {
      start = min;
      end = max;
    } else if (rangeOrStart.includes('-')) {
      const [startText, endText] = rangeOrStart.split('-');
      start = Number(startText);
      end = Number(endText);
    } else {
      start = Number(rangeOrStart);
      end = stepText === undefined ? start : max;
    }

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < min ||
      end > max ||
      start > end
    ) {
      throw new Error(`Invalid cron field value: ${part}`);
    }

    return value >= start && value <= end && (value - start) % step === 0;
  });
}

export function matchesCronSchedule(expression: string, date: Date): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5 || Number.isNaN(date.getTime())) {
    throw new Error(`Invalid five-field cron schedule: ${expression}`);
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  return (
    matchesField(minute, date.getUTCMinutes(), 0, 59) &&
    matchesField(hour, date.getUTCHours(), 0, 23) &&
    matchesField(dayOfMonth, date.getUTCDate(), 1, 31) &&
    matchesField(month, date.getUTCMonth() + 1, 1, 12) &&
    matchesField(dayOfWeek, date.getUTCDay(), 0, 6)
  );
}

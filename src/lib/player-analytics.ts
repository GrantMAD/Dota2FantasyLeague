export interface PlayerAnalyticsSample {
  gameweekId: number;
  points: number;
  price: number | null;
}

export interface PlayerAnalyticsOptions {
  roleAverage?: number | null;
  role?: string | null;
}

export function buildPlayerAnalytics(
  samples: PlayerAnalyticsSample[],
  options?: PlayerAnalyticsOptions,
) {
  const orderedSamples = [...samples].sort((a, b) => a.gameweekId - b.gameweekId);
  const points = orderedSamples.map((sample) => sample.points);
  const averagePoints = points.length ? points.reduce((sum, value) => sum + value, 0) / points.length : 0;
  const latest = orderedSamples.at(-1);
  const latestPricedSample = [...orderedSamples].reverse().find((sample) => sample.price !== null);
  const previousPricedSample = latestPricedSample
    ? [...orderedSamples]
        .reverse()
        .find((sample) => sample.gameweekId < latestPricedSample.gameweekId && sample.price !== null)
    : undefined;
  const form = orderedSamples.slice(-5).map((sample) => sample.points);

  // Floor (10th percentile / minimum realistic outcome) and Ceiling (90th percentile / peak upside)
  let floor = 0;
  let ceiling = 0;
  let volatility = 'Medium';
  let consistencyRate = 0;

  if (points.length > 0) {
    const sortedPoints = [...points].sort((a, b) => a - b);
    const p10Index = Math.floor(sortedPoints.length * 0.1);
    const p90Index = Math.min(sortedPoints.length - 1, Math.floor(sortedPoints.length * 0.9));
    floor = Number(sortedPoints[p10Index].toFixed(1));
    ceiling = Number(sortedPoints[p90Index].toFixed(1));

    // Consistency rate: % of games where score is at least 85% of benchmark
    const benchmark = options?.roleAverage ?? averagePoints;
    const consistentGames = points.filter((p) => p >= benchmark * 0.85).length;
    consistencyRate = Number(((consistentGames / points.length) * 100).toFixed(0));

    // Volatility calculation (spread between ceiling and floor relative to average)
    const spread = ceiling - floor;
    if (spread > (averagePoints * 0.8) && spread > 12) {
      volatility = 'High';
    } else if (spread < (averagePoints * 0.4) || spread < 6) {
      volatility = 'Low';
    } else {
      volatility = 'Medium';
    }
  }

  // Smarter weighted projection: 50% last 3 games form, 30% last 5 games form, 20% season average
  let projectedPoints = averagePoints;
  if (form.length > 0) {
    const last3 = form.slice(-3);
    const avgLast3 = last3.reduce((sum, v) => sum + v, 0) / last3.length;
    const avgLast5 = form.reduce((sum, v) => sum + v, 0) / form.length;
    projectedPoints = avgLast3 * 0.5 + avgLast5 * 0.3 + averagePoints * 0.2;
  }

  // Role relative differential (+/- vs average for that position)
  const roleAverage = options?.roleAverage ?? null;
  const roleDelta = roleAverage !== null ? Number((averagePoints - roleAverage).toFixed(2)) : null;

  return {
    matches: orderedSamples.length,
    averagePoints: Number(averagePoints.toFixed(2)),
    latestPoints: latest?.points ?? 0,
    latestPrice: latestPricedSample?.price ?? 0,
    priceChange: Number((
      (latestPricedSample?.price ?? 0) -
      (previousPricedSample?.price ?? latestPricedSample?.price ?? 0)
    ).toFixed(2)),
    form,
    projectedPoints: Number(projectedPoints.toFixed(2)),
    bestPoints: Math.max(0, ...points),
    floor,
    ceiling,
    volatility,
    consistencyRate,
    role: options?.role ?? null,
    roleAverage: roleAverage !== null ? Number(roleAverage.toFixed(2)) : null,
    roleDelta,
  };
}

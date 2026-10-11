export interface PlayerAnalyticsSample {
  gameweekId: number;
  points: number;
  price: number | null;
}

export function buildPlayerAnalytics(samples: PlayerAnalyticsSample[]) {
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
    projectedPoints: Number((form.length ? form.reduce((sum, value) => sum + value, 0) / form.length : averagePoints).toFixed(2)),
    bestPoints: Math.max(0, ...points),
  };
}

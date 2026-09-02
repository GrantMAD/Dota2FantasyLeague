export interface PlayerAnalyticsSample {
  gameweekId: number;
  points: number;
  price: number;
}

export function buildPlayerAnalytics(samples: PlayerAnalyticsSample[]) {
  const points = samples.map((sample) => sample.points);
  const averagePoints = points.length ? points.reduce((sum, value) => sum + value, 0) / points.length : 0;
  const latest = samples.at(-1);
  const previous = samples.at(-2);
  const form = samples.slice(-5).map((sample) => sample.points);

  return {
    matches: samples.length,
    averagePoints: Number(averagePoints.toFixed(2)),
    latestPoints: latest?.points ?? 0,
    latestPrice: latest?.price ?? 0,
    priceChange: Number(((latest?.price ?? 0) - (previous?.price ?? latest?.price ?? 0)).toFixed(2)),
    form,
    projectedPoints: Number((form.length ? form.reduce((sum, value) => sum + value, 0) / form.length : averagePoints).toFixed(2)),
    bestPoints: Math.max(0, ...points),
  };
}

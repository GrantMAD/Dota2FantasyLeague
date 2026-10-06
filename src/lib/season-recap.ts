export type SeasonRecap = {
  seasonId: number;
  fantasySeasonId: number;
  seasonName: string;
  startDate: string | null;
  endDate: string | null;
  totalPoints: number;
  finalGlobalRank: number | null;
  bestGameweek: { gameweek: number; points: number } | null;
  rankProgression: { startingRank: number; finalRank: number } | null;
  topPlayer: { name: string; points: number } | null;
  transferCount: number;
  bestLeagueRank: number | null;
};

export function formatSeasonDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function getSeasonRecapShareText(recap: SeasonRecap): string {
  const details = [
    `Season points: ${recap.totalPoints.toFixed(1)}`,
    recap.finalGlobalRank != null ? `Global finish: #${recap.finalGlobalRank}` : null,
    recap.bestGameweek ? `Best gameweek: GW ${recap.bestGameweek.gameweek} (${recap.bestGameweek.points.toFixed(1)} points)` : null,
    recap.topPlayer ? `Top-scoring pick: ${recap.topPlayer.name} (${recap.topPlayer.points.toFixed(1)} points)` : null,
    recap.rankProgression
      ? `Rank progress: #${recap.rankProgression.startingRank} to #${recap.rankProgression.finalRank}`
      : null,
    recap.bestLeagueRank != null ? `Best league finish: #${recap.bestLeagueRank}` : null,
    `Transfers: ${recap.transferCount}`,
  ].filter((value): value is string => value !== null);

  return `My ${recap.seasonName} Fantasy recap\n${details.join('\n')}\n\nShared without manager name or account details.`;
}

export function createSeasonRecapShareCardSvg(recap: SeasonRecap): string {
  const rows = [
    ['Season points', recap.totalPoints.toFixed(1)],
    ['Global finish', recap.finalGlobalRank != null ? `#${recap.finalGlobalRank}` : 'Not ranked'],
    ['Best gameweek', recap.bestGameweek ? `GW ${recap.bestGameweek.gameweek} · ${recap.bestGameweek.points.toFixed(1)} pts` : 'No score recorded'],
    ['Top-scoring pick', recap.topPlayer ? `${recap.topPlayer.name} · ${recap.topPlayer.points.toFixed(1)} pts` : 'No score recorded'],
    ['Rank progress', recap.rankProgression
      ? `#${recap.rankProgression.startingRank} → #${recap.rankProgression.finalRank}`
      : 'Not available'],
    ['Best league finish', recap.bestLeagueRank != null ? `#${recap.bestLeagueRank}` : 'No league result'],
    ['Transfers', String(recap.transferCount)],
  ];
  const rowSvg = rows.map(([label, value], index) => {
    const y = 252 + index * 48;
    return `<text x="48" y="${y}" fill="#94a3b8" font-size="18">${escapeXml(label)}</text><text x="752" y="${y}" fill="#f8fafc" font-size="18" text-anchor="end">${escapeXml(value)}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="640" viewBox="0 0 800 640">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f172a"/><stop offset="1" stop-color="#164e63"/></linearGradient></defs>
    <rect width="800" height="640" rx="32" fill="url(#bg)"/>
    <rect x="24" y="24" width="752" height="592" rx="24" fill="none" stroke="#22d3ee" stroke-opacity=".35"/>
    <text x="48" y="80" fill="#67e8f9" font-size="16" font-weight="700" letter-spacing="3">DOTA FANTASY · SEASON RECAP</text>
    <text x="48" y="142" fill="#f8fafc" font-size="34" font-weight="700">${escapeXml(recap.seasonName)}</text>
    <text x="48" y="178" fill="#94a3b8" font-size="16">${escapeXml([formatSeasonDate(recap.startDate), formatSeasonDate(recap.endDate)].filter(Boolean).join(' — '))}</text>
    <line x1="48" y1="205" x2="752" y2="205" stroke="#334155"/>
    ${rowSvg}
    <text x="48" y="608" fill="#64748b" font-size="13">Shared voluntarily · No manager name or account details included</text>
  </svg>`;
}

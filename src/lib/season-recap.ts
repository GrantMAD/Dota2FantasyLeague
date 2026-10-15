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

export type SeasonRecapCardTheme = 'radiant' | 'dire' | 'aegis';

export const SEASON_RECAP_CARD_THEMES: Array<{
  id: SeasonRecapCardTheme;
  name: string;
  description: string;
  startColor: string;
  endColor: string;
  accentColor: string;
  borderColor: string;
  labelColor: string;
  mutedColor: string;
  dividerColor: string;
}> = [
  {
    id: 'radiant',
    name: 'Radiant',
    description: 'Teal and cyan',
    startColor: '#0f172a',
    endColor: '#164e63',
    accentColor: '#67e8f9',
    borderColor: '#22d3ee',
    labelColor: '#94a3b8',
    mutedColor: '#64748b',
    dividerColor: '#334155',
  },
  {
    id: 'dire',
    name: 'Dire',
    description: 'Crimson and ember',
    startColor: '#1c1018',
    endColor: '#7f1d1d',
    accentColor: '#fda4af',
    borderColor: '#fb7185',
    labelColor: '#fecdd3',
    mutedColor: '#fda4af',
    dividerColor: '#881337',
  },
  {
    id: 'aegis',
    name: 'Aegis',
    description: 'Gold and midnight',
    startColor: '#111827',
    endColor: '#713f12',
    accentColor: '#fde68a',
    borderColor: '#fbbf24',
    labelColor: '#d6d3d1',
    mutedColor: '#a8a29e',
    dividerColor: '#57534e',
  },
];

function getSeasonRecapCardTheme(themeId: SeasonRecapCardTheme) {
  return SEASON_RECAP_CARD_THEMES.find((theme) => theme.id === themeId) ?? SEASON_RECAP_CARD_THEMES[0];
}

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

export function createSeasonRecapShareCardSvg(
  recap: SeasonRecap,
  themeId: SeasonRecapCardTheme = 'radiant'
): string {
  const theme = getSeasonRecapCardTheme(themeId);
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
    return `<text x="48" y="${y}" fill="${theme.labelColor}" font-size="18">${escapeXml(label)}</text><text x="752" y="${y}" fill="#f8fafc" font-size="18" text-anchor="end">${escapeXml(value)}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="640" viewBox="0 0 800 640">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${theme.startColor}"/><stop offset="1" stop-color="${theme.endColor}"/></linearGradient></defs>
    <rect width="800" height="640" rx="32" fill="url(#bg)"/>
    <rect x="24" y="24" width="752" height="592" rx="24" fill="none" stroke="${theme.borderColor}" stroke-opacity=".45"/>
    <text x="48" y="80" fill="${theme.accentColor}" font-size="16" font-weight="700" letter-spacing="3">DOTA FANTASY · SEASON RECAP</text>
    <text x="48" y="142" fill="#f8fafc" font-size="34" font-weight="700">${escapeXml(recap.seasonName)}</text>
    <text x="48" y="178" fill="${theme.labelColor}" font-size="16">${escapeXml([formatSeasonDate(recap.startDate), formatSeasonDate(recap.endDate)].filter(Boolean).join(' — '))}</text>
    <line x1="48" y1="205" x2="752" y2="205" stroke="${theme.dividerColor}"/>
    ${rowSvg}
    <text x="48" y="608" fill="${theme.mutedColor}" font-size="13">Shared voluntarily · No manager name or account details included</text>
  </svg>`;
}

export function getTeamDisplayTag(name: string): string {
  const normalized = name.trim();
  if (!normalized) return '???';
  if (normalized.length <= 3 && !/\s/.test(normalized)) return normalized.toUpperCase();
  if (/^\d+$/.test(normalized)) return `T${normalized.slice(-2)}`;

  const words = normalized.split(/[\s_-]+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((word) => word[0]).join('').toUpperCase();
}

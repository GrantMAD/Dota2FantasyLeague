const STEAM_ID_BASE = BigInt('76561197960265728');
const MAX_STEAM_ACCOUNT_ID = BigInt('4294967295');

export function normalizePlayerIdentity(value: string | null | undefined): string | null {
  const identifier = value?.trim();
  if (!identifier) return null;
  if (!/^\d+$/.test(identifier)) return `provider:${identifier}`;

  const numericId = BigInt(identifier);
  if (numericId > STEAM_ID_BASE && numericId <= STEAM_ID_BASE + MAX_STEAM_ACCOUNT_ID) {
    return `steam-account:${numericId - STEAM_ID_BASE}`;
  }
  if (numericId > BigInt('0') && numericId <= MAX_STEAM_ACCOUNT_ID) {
    return `steam-account:${numericId}`;
  }
  return `provider:${identifier}`;
}

export function getPlayerIdentityKeys(...identifiers: Array<string | null | undefined>): string[] {
  return [...new Set(identifiers
    .map(normalizePlayerIdentity)
    .filter((identity): identity is string => identity !== null))];
}

export function getCanonicalSteamId(value: string): string {
  const identity = normalizePlayerIdentity(value);
  if (!identity?.startsWith('steam-account:')) return value.trim();
  const accountId = identity.slice('steam-account:'.length);
  return (STEAM_ID_BASE + BigInt(accountId)).toString();
}

export function hasCanonicalSteamId(...identifiers: Array<string | null | undefined>): boolean {
  return identifiers.some((value) => {
    const identity = normalizePlayerIdentity(value);
    if (!identity?.startsWith('steam-account:')) return false;
    const identifier = value?.trim();
    return Boolean(identifier && BigInt(identifier) > STEAM_ID_BASE);
  });
}

export function deduplicatePlayerRecords<T extends { id: string; steamId: string }>(players: T[]): T[] {
  const prioritizedPlayers = [...players].sort((left, right) => {
    const leftCanonical = hasCanonicalSteamId(left.steamId, left.id) ? 1 : 0;
    const rightCanonical = hasCanonicalSteamId(right.steamId, right.id) ? 1 : 0;
    return rightCanonical - leftCanonical;
  });
  const seenIdentities = new Set<string>();
  const uniquePlayers: T[] = [];

  for (const player of prioritizedPlayers) {
    const identities = getPlayerIdentityKeys(player.steamId, player.id);
    if (identities.some((identity) => seenIdentities.has(identity))) continue;
    identities.forEach((identity) => seenIdentities.add(identity));
    uniquePlayers.push(player);
  }

  return uniquePlayers;
}

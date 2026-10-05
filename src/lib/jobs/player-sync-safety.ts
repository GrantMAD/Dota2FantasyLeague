const MINIMUM_PLAYER_FEED_COVERAGE = 0.5;

export function shouldDeactivateMissingPlayers(
  fetchedProviderPlayerCount: number,
  existingProviderPlayerCount: number,
): boolean {
  if (fetchedProviderPlayerCount <= 0) return false;
  if (existingProviderPlayerCount <= 0) return true;

  return fetchedProviderPlayerCount >= Math.ceil(existingProviderPlayerCount * MINIMUM_PLAYER_FEED_COVERAGE);
}

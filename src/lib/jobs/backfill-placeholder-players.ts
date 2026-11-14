/**
 * Backfill Placeholder Players Job
 *
 * Inspects all player records whose names are placeholders (e.g., 'Player (Lone Druid)' or 'Player #12345'),
 * queries the OpenDota API (/players/{account_id}) to fetch real player names and avatars,
 * and updates their roles and profiles in the database.
 *
 * If OpenDota has no data for a player, the job falls back to Stratz's fetchPlayer()
 * before marking the player as skipped. Stratz is instantiated lazily — only when
 * OpenDota misses at least one player — so runs where OpenDota covers everything
 * stay zero-cost.
 */

import { getSupabaseServerClient } from '@/lib/db/supabase-server';

export interface BackfillPlayersResult {
  totalPlaceholders: number;
  updated: number;
  skipped: number;
  errors: string[];
  duration: number;
  startedAt: Date;
  completedAt: Date;
}

interface OpenDotaPlayerEntry {
  account_id: number;
  steamid?: string | null;
  name?: string | null;
  personaname?: string | null;
  country_code?: string | null;
  loccountrycode?: string | null;
  avatarfull?: string | null;
  avatarmedium?: string | null;
  fantasy_role?: number | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface StratzPlayerResult {
  name: string | null;
  country: string | null;
  avatarUrl: string | null;
}

async function fetchPlayerFromStratz(accountId: string): Promise<StratzPlayerResult> {
  const empty: StratzPlayerResult = { name: null, country: null, avatarUrl: null };
  const apiKey = process.env.STRATZ_API_KEY;
  const apiUrl = process.env.STRATZ_API_URL || 'https://api.stratz.com/graphql';
  if (!apiKey) return empty;

  try {
    const { StratzProvider } = await import('../data-providers/stratz-provider');
    const stratz = new StratzProvider({ apiKey, apiUrl });
    const data = await stratz.fetchPlayer(accountId);
    return {
      name: data.name && data.name !== 'Unknown' ? data.name : null,
      country: data.country ?? null,
      avatarUrl: data.imageUrl ?? null,
    };
  } catch {
    return empty;
  }
}

// Hero display name to likely primary role mapping (used as fallback when OpenDota profile has no fantasy role)
const HERO_ROLE_FALLBACK: Record<string, string> = {
  // Supports
  'Snapfire': 'Support',
  'Crystal Maiden': 'Support',
  'Lion': 'Support',
  'Shadow Shaman': 'Support',
  'Witch Doctor': 'Support',
  'Lich': 'Support',
  'Bane': 'Support',
  'Dazzle': 'Support',
  'Jakiro': 'Support',
  'Rubick': 'Support',
  'Disruptor': 'Support',
  'Oracle': 'Support',
  'Winter Wyvern': 'Support',
  'Grimstroke': 'Support',
  'Io': 'Support',
  'Chen': 'Support',
  'Ancient Apparition': 'Support',
  'Treant Protector': 'Support',
  'Ogre Magi': 'Support',
  'Undying': 'Support',
  'Shadow Demon': 'Support',
  // Offlaners
  'Slardar': 'Offlane',
  'Axe': 'Offlane',
  'Centaur Warrunner': 'Offlane',
  'Tidehunter': 'Offlane',
  'Bristleback': 'Offlane',
  'Mars': 'Offlane',
  'Timbersaw': 'Offlane',
  'Underlord': 'Offlane',
  'Dark Seer': 'Offlane',
  'Beastmaster': 'Offlane',
  'Night Stalker': 'Offlane',
  'Doom': 'Offlane',
  'Primal Beast': 'Offlane',
  'Dawnbreaker': 'Offlane',
  // Midlaners
  'Death Prophet': 'Mid',
  'Ember Spirit': 'Mid',
  'Dragon Knight': 'Mid',
  'Storm Spirit': 'Mid',
  'Void Spirit': 'Mid',
  'Puck': 'Mid',
  'Queen of Pain': 'Mid',
  'Invoker': 'Mid',
  'Lina': 'Mid',
  'Shadow Fiend': 'Mid',
  'Tinker': 'Mid',
  'Leshrac': 'Mid',
  'Outworld Destroyer': 'Mid',
  // Carries
  'Lone Druid': 'Carry',
  'Alchemist': 'Carry',
  'Medusa': 'Carry',
  'Monkey King': 'Carry',
  'Anti-Mage': 'Carry',
  'Phantom Assassin': 'Carry',
  'Faceless Void': 'Carry',
  'Juggernaut': 'Carry',
  'Morphling': 'Carry',
  'Phantom Lancer': 'Carry',
  'Spectre': 'Carry',
  'Sven': 'Carry',
  'Terrorblade': 'Carry',
  'Drow Ranger': 'Carry',
  'Luna': 'Carry',
  'Ursa': 'Carry',
  'Slark': 'Carry',
  'Troll Warlord': 'Carry',
  'Lifestealer': 'Carry',
  'Wraith King': 'Carry',
};

/**
 * Normalise role strings to database ENUM values ('Carry' | 'Mid' | 'Offlane' | 'Support' | 'Hard Support')
 */
function normaliseRole(raw: string | number | null | undefined): string | null {
  if (!raw && raw !== 0) return null;
  const s = String(raw).trim().toUpperCase();
  if (s === '1' || s === 'POSITION_1' || s === 'SAFELANE' || s === 'CARRY' || s === 'CORE') return 'Carry';
  if (s === '2' || s === 'POSITION_2' || s === 'MIDLANE' || s === 'MID') return 'Mid';
  if (s === '3' || s === 'POSITION_3' || s === 'OFFLANE') return 'Offlane';
  if (s === '4' || s === 'POSITION_4' || s === 'SOFT_SUPPORT' || s === 'SUPPORT') return 'Support';
  if (s === '5' || s === 'POSITION_5' || s === 'HARD_SUPPORT' || s === 'HARD SUPPORT') return 'Hard Support';
  return null;
}

interface PlaceholderPlayerRow {
  id: number;
  name: string | null;
  in_game_name: string | null;
  slug: string;
  data_provider_id: string | null;
  primary_role: string | null;
}

export async function backfillPlaceholderPlayers(): Promise<BackfillPlayersResult> {
  const startedAt = new Date();
  const result: BackfillPlayersResult = {
    totalPlaceholders: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    duration: 0,
    startedAt,
    completedAt: new Date(),
  };

  const supabase = getSupabaseServerClient();
  console.log('[backfillPlaceholderPlayers] Starting backfill job...');

  try {
    // 1. Fetch raw OpenDota pro players list to construct quick lookup map
    const { fetchRawOpenDotaProPlayers } = await import('../data-providers/opendota-provider');
    const rawProPlayers = await fetchRawOpenDotaProPlayers().catch((error: unknown) => {
      console.warn('[backfillPlaceholderPlayers] Failed to fetch proPlayers authority list:', errorMessage(error));
      return [];
    });

    const proMap = new Map<string, OpenDotaPlayerEntry>();
    for (const p of rawProPlayers) {
      if (p.account_id) proMap.set(String(p.account_id), p);
      if (p.steamid) proMap.set(String(p.steamid), p);
    }

    // 2. Fetch all placeholder players from database (only active players)
    const { data: placeholderPlayers, error: dbError } = await supabase
      .from('professional_players')
      .select('id, name, in_game_name, slug, data_provider_id, primary_role')
      .eq('availability_status', 'available')
      .or('name.ilike.Player (%,name.ilike.Player #%');

    if (dbError) {
      throw new Error(`Failed to query placeholder players: ${dbError.message}`);
    }

    const playersToProcess = (placeholderPlayers || []) as PlaceholderPlayerRow[];
    result.totalPlaceholders = playersToProcess.length;
    console.log(`[backfillPlaceholderPlayers] Found ${playersToProcess.length} placeholder players to backfill`);

    // Pre-fetch Steam summaries for all placeholder players in 100-player batches if Steam is available
    const steamSummaries = new Map<string, { personaname?: string; avatarfull?: string; avatarmedium?: string; avatar?: string }>();
    if (process.env.STEAM_API_KEY && playersToProcess.length > 0) {
      try {
        const { getSteamProvider } = await import('../data-providers/provider-config');
        const steam = getSteamProvider();
        const steamIds = playersToProcess
          .map((p) => p.data_provider_id || p.slug)
          .filter((id): id is string => Boolean(id && !isNaN(Number(id))))
          .map((id) => steam.toSteamId64(id));

        for (let i = 0; i < steamIds.length; i += 100) {
          const chunk = steamIds.slice(i, i + 100);
          const chunkMap = await steam.fetchPlayerSummariesBatch(chunk);
          for (const [k, v] of chunkMap.entries()) {
            steamSummaries.set(k, v);
          }
        }
        console.log(`[backfillPlaceholderPlayers] Fetched ${steamSummaries.size} player summaries from Steam in batch`);
      } catch (err) {
        console.warn('[backfillPlaceholderPlayers] Steam batch fetch failed, falling back:', errorMessage(err));
      }
    }

    // 3. Process each player with rate-limiting (to respect OpenDota 60 req/min limit)
    for (let i = 0; i < playersToProcess.length; i++) {
      const player = playersToProcess[i];
      const accountId = player.data_provider_id || player.slug;

      if (!accountId || isNaN(Number(accountId))) {
        result.skipped++;
        continue;
      }

      try {
        let realName: string | null = null;
        let realCountry: string | null = null;
        let avatarUrl: string | null = null;
        let resolvedRole: string | null = null;

        // Check if Steam batch returned summary
        const steamId64 = (BigInt(accountId) + BigInt('76561197960265728')).toString();
        const steamSummary = steamSummaries.get(steamId64);
        if (steamSummary) {
          if (steamSummary.personaname && steamSummary.personaname.trim() && steamSummary.personaname !== 'Unknown') {
            realName = steamSummary.personaname.trim();
          }
          avatarUrl = steamSummary.avatarfull || steamSummary.avatarmedium || steamSummary.avatar || null;
        }

        // Check if proPlayers list has this player
        const proEntry = proMap.get(String(accountId));
        if (proEntry) {
          if (!realName) realName = proEntry.name || proEntry.personaname || null;
          realCountry = proEntry.country_code || proEntry.loccountrycode || null;
          if (!avatarUrl) avatarUrl = proEntry.avatarfull || proEntry.avatarmedium || null;
          const roleId = proEntry.fantasy_role;
          if (roleId === 1) resolvedRole = 'Carry';
          else if (roleId === 2) resolvedRole = 'Support';
          else if (roleId === 3) resolvedRole = 'Offlane';
          else if (roleId === 4) resolvedRole = 'Mid';
        }

        // If not in Steam or pro list, query individual OpenDota /players/{account_id}
        if (!realName) {
          const openDotaUrl = process.env.OPENDOTA_API_URL || 'https://api.opendota.com/api';
          const resp = await fetch(`${openDotaUrl}/players/${accountId}`);
          if (resp.ok) {
            const data = await resp.json();
            const profile = data?.profile;
            if (profile) {
              realName = profile.name || profile.personaname || null;
              realCountry = profile.loccountrycode || null;
              avatarUrl = profile.avatarfull || profile.avatarmedium || null;
            }
          }
          // Modest pause between API calls to stay within rate limit
          await new Promise((res) => setTimeout(res, 250));
        }

        // If OpenDota had no data, fall back to Stratz
        if (!realName) {
          console.log(`[backfillPlaceholderPlayers] OpenDota had no data for ${accountId}, trying Stratz...`);
          const stratzData = await fetchPlayerFromStratz(accountId);
          if (stratzData.name) realName = stratzData.name;
          if (!realCountry && stratzData.country) realCountry = stratzData.country;
          if (!avatarUrl && stratzData.avatarUrl) avatarUrl = stratzData.avatarUrl;
        }

        // Infer role from hero name if still default or unspecified
        if (!resolvedRole) {
          const heroMatch = player.name?.match(/\((.+)\)/);
          const heroName = heroMatch ? heroMatch[1] : null;
          if (heroName && HERO_ROLE_FALLBACK[heroName]) {
            resolvedRole = HERO_ROLE_FALLBACK[heroName];
          }
        }

        const effectiveRole = normaliseRole(resolvedRole) || player.primary_role || 'Carry';

        // Build update payload
        const updatePayload: Record<string, unknown> = {
          last_synced_at: new Date().toISOString(),
          primary_role: effectiveRole,
        };

        if (realName && realName.trim() && realName !== 'Unknown') {
          updatePayload.name = realName.trim();
          updatePayload.in_game_name = realName.trim();
        }

        if (realCountry) {
          updatePayload.country = realCountry;
        }

        if (avatarUrl) {
          updatePayload.profile_image_url = avatarUrl;
        }

        const { error: updateError } = await supabase
          .from('professional_players')
          .update(updatePayload)
          .eq('id', player.id);

        if (updateError) {
          throw updateError;
        }

        result.updated++;
      } catch (error: unknown) {
        result.errors.push(`Player ${player.id} (${accountId}): ${errorMessage(error)}`);
      }
    }

    console.log(`[backfillPlaceholderPlayers] Finished: ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`);
  } catch (error: unknown) {
    console.error('[backfillPlaceholderPlayers] Job failed:', error);
    result.errors.push(errorMessage(error));
  }

  result.completedAt = new Date();
  result.duration = result.completedAt.getTime() - result.startedAt.getTime();
  return result;
}

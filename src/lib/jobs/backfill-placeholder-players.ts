/**
 * Backfill Placeholder Players Job
 * 
 * Inspects all player records whose names are placeholders (e.g., 'Player (Lone Druid)' or 'Player #12345'),
 * queries the OpenDota API (/players/{account_id}) to fetch real player names and avatars,
 * and updates their roles and profiles in the database.
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
    const rawProPlayers = await fetchRawOpenDotaProPlayers().catch((err: any) => {
      console.warn('[backfillPlaceholderPlayers] Failed to fetch proPlayers authority list:', err.message);
      return [];
    });

    const proMap = new Map<string, any>();
    for (const p of rawProPlayers) {
      if (p.account_id) proMap.set(String(p.account_id), p);
      if (p.steamid) proMap.set(String(p.steamid), p);
    }

    // 2. Fetch all placeholder players from database
    const { data: placeholderPlayers, error: dbError } = await supabase
      .from('professional_players')
      .select('id, name, in_game_name, slug, data_provider_id, primary_role')
      .or('name.ilike.Player (%,name.ilike.Player #%');

    if (dbError) {
      throw new Error(`Failed to query placeholder players: ${dbError.message}`);
    }

    const playersToProcess = placeholderPlayers || [];
    result.totalPlaceholders = playersToProcess.length;
    console.log(`[backfillPlaceholderPlayers] Found ${playersToProcess.length} placeholder players to backfill`);

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

        // Check if proPlayers list has this player
        const proEntry = proMap.get(String(accountId));
        if (proEntry) {
          realName = proEntry.name || proEntry.personaname || null;
          realCountry = proEntry.country_code || proEntry.loccountrycode || null;
          avatarUrl = proEntry.avatarfull || proEntry.avatarmedium || null;
          const roleId = proEntry.fantasy_role;
          if (roleId === 1) resolvedRole = 'Carry';
          else if (roleId === 2) resolvedRole = 'Support';
          else if (roleId === 3) resolvedRole = 'Offlane';
          else if (roleId === 4) resolvedRole = 'Mid';
        }

        // If not in pro list, query individual OpenDota /players/{account_id}
        if (!realName) {
          const resp = await fetch(`https://api.opendota.com/api/players/${accountId}`);
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
      } catch (err: any) {
        result.errors.push(`Player ${player.id} (${accountId}): ${err.message}`);
      }
    }

    console.log(`[backfillPlaceholderPlayers] Finished: ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`);
  } catch (error: any) {
    console.error('[backfillPlaceholderPlayers] Job failed:', error);
    result.errors.push(error.message);
  }

  result.completedAt = new Date();
  result.duration = result.completedAt.getTime() - result.startedAt.getTime();
  return result;
}

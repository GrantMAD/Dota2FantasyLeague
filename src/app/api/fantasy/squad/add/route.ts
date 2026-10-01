import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, AuthError } from '@/lib/auth-utils';

// 5 starters (carry, mid, offlane, support, hard_support) + 3 bench
const SQUAD_MAX_SIZE = 8;

interface FantasySeasonBudgetRow {
  id: number;
  budget: number;
}

interface SquadMemberRow {
  player_id: number;
  removed_date: string | null;
}

interface FantasySquadRow {
  id: number;
  fantasy_squad_members: SquadMemberRow[];
}

interface PlayerPriceRow {
  player_id: number;
  price: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const supabase = supabaseServer();

    const body = (await request.json()) as { fantasySeasonId?: unknown; playerIds?: unknown };
    const { fantasySeasonId, playerIds } = body;

    if (!fantasySeasonId || typeof fantasySeasonId !== 'number') {
      return NextResponse.json({ error: 'Invalid or missing fantasySeasonId.' }, { status: 400 });
    }
    if (
      !Array.isArray(playerIds) ||
      playerIds.length === 0 ||
      !playerIds.every((id): id is number => typeof id === 'number' && Number.isInteger(id))
    ) {
      return NextResponse.json({ error: 'playerIds must be a non-empty array of integer IDs.' }, { status: 400 });
    }
    const selectedPlayerIds = playerIds;

    // 1. Verify the fantasy season belongs to this user
    const { data: seasonData, error: seasonError } = await supabase
      .from('fantasy_seasons')
      .select('id, budget')
      .eq('id', fantasySeasonId)
      .eq('user_id', userId)
      .maybeSingle();
    const season = seasonData as FantasySeasonBudgetRow | null;

    if (seasonError || !season) {
      return NextResponse.json({ error: 'Fantasy season not found.' }, { status: 404 });
    }

    // 2. Get the squad — auto-create if it doesn't exist yet
    //    (allows users to delete the squad row in Supabase and start fresh)
    const { data: existingSquadData, error: squadError } = await supabase
      .from('fantasy_squads')
      .select('id, fantasy_squad_members(player_id, removed_date)')
      .eq('fantasy_season_id', fantasySeasonId)
      .maybeSingle();
    const existingSquad = existingSquadData as FantasySquadRow | null;

    if (squadError) {
      return NextResponse.json({ error: 'Failed to load squad.' }, { status: 500 });
    }

    let squad: FantasySquadRow | null = existingSquad;
    if (!squad) {
      // No squad row yet — create one automatically
      const { data: newSquadData, error: createError } = await supabase
        .from('fantasy_squads')
        .insert({ fantasy_season_id: fantasySeasonId, name: 'My Fantasy Squad' })
        .select('id, fantasy_squad_members(player_id, removed_date)')
        .maybeSingle();
      const newSquad = newSquadData as FantasySquadRow | null;

      if (createError || !newSquad) {
        console.error('Error creating squad:', createError);
        return NextResponse.json({ error: 'Failed to create squad.' }, { status: 500 });
      }
      squad = newSquad;
    }

    const currentMembers = (squad.fantasy_squad_members ?? []).filter((member) => !member.removed_date);
    const currentMemberIds = new Set<number>(currentMembers.map((member) => member.player_id));

    // 3. Validate the selection
    const uniquePlayerIds = [...new Set(selectedPlayerIds)];

    // Check none are already owned
    const alreadyOwned = uniquePlayerIds.filter((id) => currentMemberIds.has(id));
    if (alreadyOwned.length > 0) {
      return NextResponse.json(
        { error: 'One or more selected players are already in your squad.' },
        { status: 400 }
      );
    }

    // Check squad won't exceed max size
    if (currentMembers.length + uniquePlayerIds.length > SQUAD_MAX_SIZE) {
      return NextResponse.json(
        { error: `Adding these players would exceed the squad limit of ${SQUAD_MAX_SIZE}.` },
        { status: 400 }
      );
    }

    // 4. Get prices for all selected players
    const { data: priceData } = await supabase
      .from('player_prices')
      .select('player_id, price')
      .in('player_id', uniquePlayerIds)
      .order('gameweek_id', { ascending: false });
    const priceRows = (priceData ?? []) as PlayerPriceRow[];

    // Build a latest-price map (first row per player_id = latest due to ordering)
    const priceMap = new Map<number, number>();
    for (const row of priceRows) {
      if (!priceMap.has(row.player_id)) {
        priceMap.set(row.player_id, Number(row.price ?? 0));
      }
    }

    const totalCost = uniquePlayerIds.reduce(
      (sum, id) => sum + (priceMap.get(id) ?? 0),
      0
    );

    // 5. Check budget
    if (Number(season.budget) < totalCost) {
      return NextResponse.json(
        {
          error: `Insufficient budget. Selection costs ${totalCost.toFixed(1)}M, you have ${Number(season.budget).toFixed(1)}M.`,
        },
        { status: 400 }
      );
    }

    // 6. Insert all players (include cost to satisfy NOT NULL constraint on fantasy_squad_members)
    const inserts = uniquePlayerIds.map((id) => ({
      squad_id: squad.id,
      player_id: id,
      cost: priceMap.get(id) ?? 0,
    }));

    const { error: insertError } = await supabase
      .from('fantasy_squad_members')
      .insert(inserts);

    if (insertError) {
      console.error('Error inserting squad members:', insertError);
      return NextResponse.json({ error: 'Failed to add players to squad.' }, { status: 500 });
    }

    // 7. Deduct total cost from budget
    const newBudget = Number(season.budget) - totalCost;
    await supabase
      .from('fantasy_seasons')
      .update({ budget: newBudget })
      .eq('id', fantasySeasonId);

    const newSquadSize = currentMembers.length + uniquePlayerIds.length;

    return NextResponse.json({
      message: `${uniquePlayerIds.length} player${uniquePlayerIds.length > 1 ? 's' : ''} added to squad.`,
      budget: newBudget,
      squadSize: newSquadSize,
      squadMaxSize: SQUAD_MAX_SIZE,
    });
  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

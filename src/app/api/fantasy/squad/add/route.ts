import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, AuthError } from '@/lib/auth-utils';

// 5 starters (carry, mid, offlane, support, hard_support) + 3 bench
const SQUAD_MAX_SIZE = 8;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const supabase = supabaseServer();

    const body = await request.json();
    const { fantasySeasonId, playerIds } = body;

    if (!fantasySeasonId || typeof fantasySeasonId !== 'number') {
      return NextResponse.json({ error: 'Invalid or missing fantasySeasonId.' }, { status: 400 });
    }
    if (!Array.isArray(playerIds) || playerIds.length === 0) {
      return NextResponse.json({ error: 'playerIds must be a non-empty array.' }, { status: 400 });
    }

    // 1. Verify the fantasy season belongs to this user
    const { data: season, error: seasonError } = await (supabase
      .from('fantasy_seasons') as any)
      .select('id, budget')
      .eq('id', fantasySeasonId)
      .eq('user_id', userId)
      .maybeSingle();

    if (seasonError || !season) {
      return NextResponse.json({ error: 'Fantasy season not found.' }, { status: 404 });
    }

    // 2. Get the squad — auto-create if it doesn't exist yet
    //    (allows users to delete the squad row in Supabase and start fresh)
    const { data: existingSquad, error: squadError } = await (supabase
      .from('fantasy_squads') as any)
      .select('id, fantasy_squad_members(player_id, removed_date)')
      .eq('fantasy_season_id', fantasySeasonId)
      .maybeSingle();

    if (squadError) {
      return NextResponse.json({ error: 'Failed to load squad.' }, { status: 500 });
    }

    let squad = existingSquad;
    if (!squad) {
      // No squad row yet — create one automatically
      const { data: newSquad, error: createError } = await (supabase
        .from('fantasy_squads') as any)
        .insert({ fantasy_season_id: fantasySeasonId, name: 'My Fantasy Squad' })
        .select('id, fantasy_squad_members(player_id, removed_date)')
        .maybeSingle();

      if (createError || !newSquad) {
        console.error('Error creating squad:', createError);
        return NextResponse.json({ error: 'Failed to create squad.' }, { status: 500 });
      }
      squad = newSquad;
    }

    const currentMembers = (squad.fantasy_squad_members ?? []).filter(
      (m: any) => !m.removed_date
    );
    const currentMemberIds = new Set<number>(currentMembers.map((m: any) => m.player_id));

    // 3. Validate the selection
    const uniquePlayerIds = [...new Set(playerIds)];

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
    const { data: priceRows } = await (supabase
      .from('player_prices') as any)
      .select('player_id, price')
      .in('player_id', uniquePlayerIds)
      .order('gameweek_id', { ascending: false });

    // Build a latest-price map (first row per player_id = latest due to ordering)
    const priceMap = new Map<number, number>();
    for (const row of priceRows ?? []) {
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

    const { error: insertError } = await (supabase
      .from('fantasy_squad_members') as any)
      .insert(inserts);

    if (insertError) {
      console.error('Error inserting squad members:', insertError);
      return NextResponse.json({ error: 'Failed to add players to squad.' }, { status: 500 });
    }

    // 7. Deduct total cost from budget
    const newBudget = Number(season.budget) - totalCost;
    await (supabase
      .from('fantasy_seasons') as any)
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

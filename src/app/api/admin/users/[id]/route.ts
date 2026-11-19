import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import { verifyAdminAuth, createErrorResponse } from '@/lib/auth-utils';
import { logAuditAction } from '@/lib/audit-logger';
import { withApiTelemetry } from '@/lib/api-telemetry';

interface PatchUserBody {
  role?: 'admin' | 'user';
  display_name?: string;
  bio?: string;
  is_premium?: boolean;
  subscription_tier?: string;
}

async function getHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdminAuth(request);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    // 1. Fetch user profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 2. Fetch email from auth admin if available
    let email: string | null = null;
    let emailConfirmedAt: string | null = null;
    let lastSignInAt: string | null = null;
    try {
      if (supabase.auth?.admin?.getUserById) {
        const { data: authUser } = await supabase.auth.admin.getUserById(id);
        if (authUser?.user) {
          email = authUser.user.email ?? null;
          emailConfirmedAt = authUser.user.email_confirmed_at ?? null;
          lastSignInAt = authUser.user.last_sign_in_at ?? null;
        }
      }
    } catch {
      // Ignore if auth admin is unavailable
    }

    // 3. Fetch fantasy season, squad, and members
    const { data: fantasySeasons } = await supabase
      .from('fantasy_seasons')
      .select(`
        id,
        season_id,
        budget,
        total_points,
        global_rank,
        free_transfers,
        triple_captain_gameweek_id,
        bench_boost_gameweek_id,
        wildcard_used_gameweek_id,
        created_at,
        seasons(id, name, status),
        fantasy_squads(
          id,
          name,
          created_at,
          fantasy_squad_members(
            id,
            player_id,
            cost,
            acquired_date,
            professional_players(
              id,
              name,
              in_game_name,
              primary_role,
              profile_image_url,
              professional_teams(id, name, logo_url)
            )
          )
        )
      `)
      .eq('user_id', id);

    // 4. Fetch joined leagues
    const { data: leagueMemberships } = await supabase
      .from('league_members')
      .select(`
        id,
        points,
        rank,
        joined_at,
        leagues(
          id,
          name,
          league_type,
          privacy_level,
          current_participants,
          max_participants
        )
      `)
      .eq('user_id', id);

    // 5. Fetch leagues created by this user
    const { data: createdLeagues } = await supabase
      .from('leagues')
      .select('id, name, league_type, privacy_level, current_participants, max_participants, created_at')
      .eq('creator_id', id);

    // 6. Fetch user issue reports
    const { data: issueReports } = await supabase
      .from('issue_reports')
      .select('id, title, category, severity, status, created_at, resolved_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    // 7. Fetch audit logs related to this user
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('id, table_name, action, old_values, new_values, created_at, changed_by')
      .or(`record_id.eq.${id},changed_by.eq.${id}`)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      user: {
        ...user,
        email,
        email_confirmed_at: emailConfirmedAt,
        last_sign_in_at: lastSignInAt,
      },
      fantasy_seasons: fantasySeasons || [],
      league_memberships: leagueMemberships || [],
      created_leagues: createdLeagues || [],
      issue_reports: issueReports || [],
      audit_logs: auditLogs || [],
    });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}

async function patchHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await verifyAdminAuth(request);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const body = (await request.json()) as PatchUserBody;
    const { role, display_name, bio, is_premium, subscription_tier } = body;

    const VALID_ROLES = new Set(['admin', 'user']);
    if (role !== undefined && !VALID_ROLES.has(role)) {
      return NextResponse.json(
        { error: `Invalid role "${role}". Allowed: admin, user` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Check user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, role, display_name, bio, is_premium, subscription_tier')
      .eq('id', id)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (role !== undefined) updatePayload.role = role;
    if (display_name !== undefined) updatePayload.display_name = display_name;
    if (bio !== undefined) updatePayload.bio = bio;
    if (is_premium !== undefined) updatePayload.is_premium = is_premium;
    if (subscription_tier !== undefined) updatePayload.subscription_tier = subscription_tier;

    if (Object.keys(updatePayload).length === 1) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update user: ${updateError.message}` },
        { status: 500 }
      );
    }

    await logAuditAction({
      tableName: 'users',
      recordId: id,
      action: 'UPDATE',
      changedBy: adminId,
      oldValues: existingUser,
      newValues: updatePayload,
      reason: `Admin updated user ${id} profile/role`,
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}

export const GET = withApiTelemetry('GET', '/api/admin/users/:id', getHandler);
export const PATCH = withApiTelemetry('PATCH', '/api/admin/users/:id', patchHandler);

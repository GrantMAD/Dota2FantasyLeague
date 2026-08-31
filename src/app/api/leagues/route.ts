import { NextRequest, NextResponse } from 'next/server';
import { createLeagueDraft, joinLeague } from '@/lib/fantasy-gameplay';

const sampleLeagues = [
  {
    id: 1,
    name: 'Night Raid League',
    type: 'classic',
    privacyLevel: 'private',
    description: 'Season-long classic challenge with weekly leaderboard pressure.',
    maxParticipants: 12,
    currentParticipants: 8,
    inviteCode: 'NRL-7241',
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Weekend Clash',
    type: 'h2h',
    privacyLevel: 'public',
    description: 'Fast-paced head-to-head matchups across each gameweek.',
    maxParticipants: 8,
    currentParticipants: 6,
    inviteCode: 'WKC-9913',
    createdAt: new Date().toISOString(),
  },
];

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type');
  const privacy = request.nextUrl.searchParams.get('privacy');

  let leagues = [...sampleLeagues];

  if (type && type !== 'all') {
    leagues = leagues.filter((league) => league.type === type);
  }

  if (privacy && privacy !== 'all') {
    leagues = leagues.filter((league) => league.privacyLevel === privacy);
  }

  return NextResponse.json({ data: leagues, count: leagues.length });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode.trim() : '';
    const action = body.action === 'join' ? 'join' : 'create';

    if (action === 'join') {
      if (!inviteCode) {
        return NextResponse.json({ error: 'Invite code is required to join a league.' }, { status: 400 });
      }

      const league = sampleLeagues.find(
        (entry) => entry.inviteCode.toLowerCase() === inviteCode.toLowerCase(),
      );

      if (!league) {
        return NextResponse.json({ error: 'That invite code does not match an active league.' }, { status: 404 });
      }

      const membership = joinLeague(league.currentParticipants, league.maxParticipants);
      if (!membership.allowed) {
        return NextResponse.json({ error: membership.reason, league }, { status: 409 });
      }

      league.currentParticipants += 1;
      return NextResponse.json({
        data: league,
        message: `Joined ${league.name} successfully.`,
      });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const type = body.type === 'h2h' ? 'h2h' : 'classic';
    const privacyLevel = body.privacyLevel === 'public' ? 'public' : 'private';
    const maxParticipants = Number(body.maxParticipants || 8);

    if (!name) {
      return NextResponse.json({ error: 'League name is required.' }, { status: 400 });
    }

    const draft = createLeagueDraft({
      name,
      type,
      privacyLevel,
      maxParticipants,
      description: typeof body.description === 'string' ? body.description : undefined,
      currentParticipants: 0,
    });

    const created = {
      id: Date.now(),
      name: draft.name,
      type: draft.type,
      privacyLevel: draft.privacyLevel,
      description: draft.description,
      maxParticipants,
      currentParticipants: 1,
      inviteCode: draft.inviteCode,
      createdAt: draft.createdAt,
    };

    sampleLeagues.unshift(created);

    return NextResponse.json({ data: created, message: 'League created successfully.' }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process league request.', details: String(error) },
      { status: 500 },
    );
  }
}

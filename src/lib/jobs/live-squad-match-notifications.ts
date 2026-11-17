import { getEquivalentProviderIds, getPlayerIdentityKeys } from './player-identity';
import {
  notifyMatchLifecycleMilestone,
} from './match-lifecycle-notifications';

export interface LiveMatchNotificationCandidate {
  id: number;
  externalMatchId: string;
  playerAccountIds: string[];
}

interface ProfessionalPlayerRow {
  id: number;
  data_provider_id: string | null;
}

export async function notifyLiveSquadMembers(
  supabase: ReturnType<typeof import('@/lib/db/supabase-server').getSupabaseServerClient>,
  candidates: LiveMatchNotificationCandidate[],
): Promise<{ notificationsCreated: number; pushNotificationsSent: number; errors: string[] }> {
  const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.id, candidate])).values()];
  const providerIds = [...new Set(uniqueCandidates.flatMap((candidate) =>
    getEquivalentProviderIds(...candidate.playerAccountIds)
  ))];
  if (providerIds.length === 0) {
    return { notificationsCreated: 0, pushNotificationsSent: 0, errors: [] };
  }

  const { data: rawPlayers, error } = await supabase
    .from('professional_players')
    .select('id, data_provider_id')
    .in('data_provider_id', providerIds);
  if (error) throw new Error(`Unable to resolve live match players: ${error.message}`);

  const players = (rawPlayers ?? []) as ProfessionalPlayerRow[];
  const identitiesByMatch = uniqueCandidates.map((candidate) => {
    const identities = new Set(candidate.playerAccountIds.flatMap((id) => getPlayerIdentityKeys(id)));
    const playerIds = players
      .filter((player) => getPlayerIdentityKeys(player.data_provider_id).some((identity) => identities.has(identity)))
      .map((player) => player.id);
    return { ...candidate, playerIds };
  });

  return notifyMatchLifecycleMilestone(
    supabase,
    identitiesByMatch,
    'starting',
  );
}

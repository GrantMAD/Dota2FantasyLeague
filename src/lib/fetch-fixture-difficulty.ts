'use client';

import { fetchWithAuth } from '@/lib/fetch-with-auth';
import type { FixtureDifficultyResult } from '@/lib/fixture-difficulty';

const MAX_TEAM_IDS_PER_REQUEST = 20;

export async function fetchFixtureDifficulty(
  teamIds: number[],
): Promise<Map<number, FixtureDifficultyResult>> {
  const uniqueTeamIds = [...new Set(teamIds)];
  const batches: number[][] = [];
  for (let index = 0; index < uniqueTeamIds.length; index += MAX_TEAM_IDS_PER_REQUEST) {
    batches.push(uniqueTeamIds.slice(index, index + MAX_TEAM_IDS_PER_REQUEST));
  }

  const responses = await Promise.all(batches.map(async (batch) => {
    const response = await fetchWithAuth(
      `/api/fantasy/fixture-difficulty?teamIds=${encodeURIComponent(batch.join(','))}`,
    );
    const data = await response.json() as {
      error?: string;
      ratingsByTeam?: Record<string, FixtureDifficultyResult>;
    };
    if (!response.ok) {
      throw new Error(data.error || `Unable to load fixture difficulty (${response.status})`);
    }
    return data.ratingsByTeam ?? {};
  }));

  const ratings = new Map<number, FixtureDifficultyResult>();
  for (const response of responses) {
    for (const [teamId, difficulty] of Object.entries(response)) {
      const parsedTeamId = Number(teamId);
      if (Number.isSafeInteger(parsedTeamId) && parsedTeamId > 0) {
        ratings.set(parsedTeamId, difficulty);
      }
    }
  }
  return ratings;
}

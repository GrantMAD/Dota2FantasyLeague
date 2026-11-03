'use client';

import { useMemo } from 'react';
import { Table } from 'lucide-react';
import { TeamLogo } from '@/app/(dashboard)/matches/components/TeamLogo';
import type { MatchData } from '@/app/(dashboard)/matches/components/MatchCard';

interface SeriesData {
  id: number;
  series_number: number;
  best_of: number;
  gameweek_id: number;
  team_a_id: number;
  team_b_id: number;
}

interface TeamData {
  id: number;
  name: string;
  slug: string;
  region?: string;
  logo_url: string | null;
}

interface TournamentGroupStandingsProps {
  series: SeriesData[];
  matches: MatchData[];
  teams: TeamData[];
}

interface TeamStandingRow {
  team: TeamData;
  seriesPlayed: number;
  seriesWon: number;
  seriesDrawn: number;
  seriesLost: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  points: number;
  winRate: number;
}

export function TournamentGroupStandings({ matches, teams }: TournamentGroupStandingsProps) {
  const standings = useMemo<TeamStandingRow[]>(() => {
    if (!teams || teams.length === 0) return [];

    // Initialize stats map for each team
    const statsMap = new Map<
      number,
      {
        team: TeamData;
        seriesPlayed: number;
        seriesWon: number;
        seriesDrawn: number;
        seriesLost: number;
        gamesWon: number;
        gamesLost: number;
      }
    >();

    for (const t of teams) {
      statsMap.set(t.id, {
        team: t,
        seriesPlayed: 0,
        seriesWon: 0,
        seriesDrawn: 0,
        seriesLost: 0,
        gamesWon: 0,
        gamesLost: 0,
      });
    }

    // Group matches by unique matchup pairs: pairKey -> MatchData[]
    // Pair key is sorted team IDs e.g. "74-75" or "160-649"
    const matchupGames = new Map<string, { teamAId: number; teamBId: number; matches: MatchData[] }>();

    for (const m of matches) {
      const aId = m.radiant_team_id ?? (m as unknown as { team_a_id?: number }).team_a_id;
      const bId = m.dire_team_id ?? (m as unknown as { team_b_id?: number }).team_b_id;

      if (!aId || !bId) continue;

      const lowId = Math.min(aId, bId);
      const highId = Math.max(aId, bId);
      const pairKey = `${lowId}-${highId}`;

      const pair = matchupGames.get(pairKey) || { teamAId: lowId, teamBId: highId, matches: [] };
      pair.matches.push(m);
      matchupGames.set(pairKey, pair);
    }

    // Compute records per head-to-head matchup
    for (const { teamAId, teamBId, matches: pairMatches } of matchupGames.values()) {
      let gamesWonA = 0;
      let gamesWonB = 0;
      let hasCompleted = false;

      for (const m of pairMatches) {
        const mWinner = (m as unknown as { winner_team_id?: number | null }).winner_team_id;
        if (m.status === 'completed' || mWinner) {
          hasCompleted = true;
          if (mWinner === teamAId) gamesWonA++;
          else if (mWinner === teamBId) gamesWonB++;
        }
      }

      const statsA = statsMap.get(teamAId);
      const statsB = statsMap.get(teamBId);

      if (statsA) {
        statsA.gamesWon += gamesWonA;
        statsA.gamesLost += gamesWonB;
      }
      if (statsB) {
        statsB.gamesWon += gamesWonB;
        statsB.gamesLost += gamesWonA;
      }

      if (hasCompleted) {
        if (statsA) statsA.seriesPlayed += 1;
        if (statsB) statsB.seriesPlayed += 1;

        if (gamesWonA > gamesWonB) {
          if (statsA) statsA.seriesWon += 1;
          if (statsB) statsB.seriesLost += 1;
        } else if (gamesWonB > gamesWonA) {
          if (statsB) statsB.seriesWon += 1;
          if (statsA) statsA.seriesLost += 1;
        } else {
          // Drawn (Bo2 tie)
          if (statsA) statsA.seriesDrawn += 1;
          if (statsB) statsB.seriesDrawn += 1;
        }
      }
    }

    // Calculate points: 3 pts per series win, 1 pt per draw
    const rows: TeamStandingRow[] = Array.from(statsMap.values()).map((s) => {
      const points = s.seriesWon * 3 + s.seriesDrawn * 1;
      const totalGames = s.gamesWon + s.gamesLost;
      const winRate = totalGames > 0 ? Math.round((s.gamesWon / totalGames) * 100) : 0;
      const gameDiff = s.gamesWon - s.gamesLost;

      return {
        team: s.team,
        seriesPlayed: s.seriesPlayed,
        seriesWon: s.seriesWon,
        seriesDrawn: s.seriesDrawn,
        seriesLost: s.seriesLost,
        gamesWon: s.gamesWon,
        gamesLost: s.gamesLost,
        gameDiff,
        points,
        winRate,
      };
    });

    // Sort by: Points DESC, Game Differential DESC, Games Won DESC, Team Name ASC
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      return a.team.name.localeCompare(b.team.name);
    });

    return rows;
  }, [matches, teams]);

  if (standings.length === 0) {
    return (
      <div
        className="rounded-2xl border p-10 text-center"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}
        >
          <Table className="h-6 w-6" />
        </div>
        <h3 className="mb-1 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          Standings Table Not Available
        </h3>
        <p className="mx-auto max-w-sm text-xs" style={{ color: 'var(--text-secondary)' }}>
          Group stage records and standings will calculate as soon as participating teams are populated.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Informational Guidance bar */}
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)',
              color: 'var(--accent-primary)',
              border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)',
            }}
          >
            <Table className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Group Stage Standings
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              3 points for a series win, 1 point for a tie. Top positions advance to the Upper Bracket.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--success)' }} />
            <span>Upper Bracket</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--accent-secondary)' }} />
            <span>Lower Bracket</span>
          </span>
        </div>
      </div>

      {/* Standings Table container */}
      <div
        className="overflow-hidden rounded-2xl border shadow-sm"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr
                className="border-b text-[11px] font-bold uppercase tracking-wider"
                style={{
                  background: 'var(--surface-raised)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                <th scope="col" className="py-3.5 pl-4 pr-2 w-12 text-center">#</th>
                <th scope="col" className="py-3.5 px-3">Team</th>
                <th scope="col" className="py-3.5 px-3 text-center">Played</th>
                <th scope="col" className="py-3.5 px-3 text-center">Series (W-D-L)</th>
                <th scope="col" className="py-3.5 px-3 text-center">Games (W-L)</th>
                <th scope="col" className="py-3.5 px-3 text-center">Diff</th>
                <th scope="col" className="py-3.5 px-3 text-center">Win Rate</th>
                <th scope="col" className="py-3.5 pr-4 pl-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {standings.map((row, idx) => {
                const rank = idx + 1;
                const isUpperBracket = rank <= 4;
                const isLowerBracket = rank > 4 && rank <= 8;

                const rankIndicatorColor = isUpperBracket
                  ? 'var(--success)'
                  : isLowerBracket
                  ? 'var(--accent-secondary)'
                  : 'transparent';

                return (
                  <tr
                    key={row.team.id}
                    className="transition-colors hover:bg-[var(--surface-raised)]"
                    style={{
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {/* Rank with qualification accent bar */}
                    <td className="py-3.5 pl-4 pr-2 text-center font-bold">
                      <div className="flex items-center justify-center gap-1.5">
                        <span
                          className="h-3.5 w-1 rounded-full shrink-0"
                          style={{ background: rankIndicatorColor }}
                          aria-hidden="true"
                        />
                        <span style={{ color: 'var(--text-primary)' }}>{rank}</span>
                      </div>
                    </td>

                    {/* Team with Logo and Tag */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <TeamLogo
                          name={row.team.name}
                          logoUrl={row.team.logo_url}
                          tag={row.team.name.slice(0, 4).toUpperCase()}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-xs" style={{ color: 'var(--text-primary)' }}>
                            {row.team.name}
                          </p>
                          {row.team.region && (
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              {row.team.region}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Series Played */}
                    <td className="py-3.5 px-3 text-center font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {row.seriesPlayed}
                    </td>

                    {/* Series Record W-D-L */}
                    <td className="py-3.5 px-3 text-center font-mono">
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {row.seriesWon}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}> - </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {row.seriesDrawn}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}> - </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {row.seriesLost}
                      </span>
                    </td>

                    {/* Games Record W-L */}
                    <td className="py-3.5 px-3 text-center font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {row.gamesWon} - {row.gamesLost}
                    </td>

                    {/* Differential */}
                    <td className="py-3.5 px-3 text-center font-mono font-bold">
                      <span
                        style={{
                          color: row.gameDiff > 0 ? 'var(--success)' : row.gameDiff < 0 ? 'var(--danger)' : 'var(--text-muted)',
                        }}
                      >
                        {row.gameDiff > 0 ? `+${row.gameDiff}` : row.gameDiff}
                      </span>
                    </td>

                    {/* Win Rate % */}
                    <td className="py-3.5 px-3 text-center font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {row.winRate}%
                    </td>

                    {/* Total Points */}
                    <td className="py-3.5 pr-4 pl-3 text-right">
                      <span
                        className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md font-mono text-xs font-black shadow-xs"
                        style={{
                          background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)',
                          color: 'var(--accent-primary)',
                          border: '1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)',
                        }}
                      >
                        {row.points}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

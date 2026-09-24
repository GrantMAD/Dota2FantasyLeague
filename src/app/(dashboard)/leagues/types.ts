export type StandingEntry = {
  userId?: string;
  manager: string;
  username?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  points: number;
  gwPoints?: number;
  rank: number | null;
  wins: number;
  losses: number;
  draws: number;
  form: string[];
};

export type FixtureEntry = {
  id: number;
  leagueId?: number;
  leagueName?: string;
  gameweekId: number;
  home: string;
  homeUsername?: string;
  homeAvatarUrl?: string | null;
  away: string;
  awayUsername?: string | null;
  awayAvatarUrl?: string | null;
  homePoints: number;
  awayPoints: number;
  winnerId: number | null;
  isBye: boolean;
};

export type LeagueRecord = {
  id: number;
  name: string;
  type: 'classic' | 'h2h';
  privacyLevel: 'public' | 'private';
  description: string;
  maxParticipants: number;
  currentParticipants: number;
  inviteCode: string;
  standings?: StandingEntry[];
  fixtures?: FixtureEntry[];
};

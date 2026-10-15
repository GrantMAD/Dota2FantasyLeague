export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'squad' | 'performance' | 'activity' | 'career';
  tier: 'bronze' | 'silver' | 'gold' | 'mythic';
  icon: string;
  unlocked: boolean;
  progressText: string;
  progressPercent: number;
  unlockedAtLabel?: string;
}

export interface UserStatsForAchievements {
  hasSquad: boolean;
  squadName?: string | null;
  totalPoints: number;
  globalRank: number | null;
  hasBio: boolean;
  memberSince?: string | null;
  timezone?: string | null;
  countryCode?: string | null;
}

export function computeAchievements(stats: UserStatsForAchievements): Achievement[] {
  const { hasSquad, totalPoints, globalRank, hasBio, timezone, countryCode } = stats;

  const profileCompleteCount = [
    Boolean(hasBio),
    Boolean(timezone),
    Boolean(countryCode),
  ].filter(Boolean).length;

  return [
    {
      id: 'first-squad',
      title: 'First Squad',
      description: 'Created your first fantasy squad for the tournament season.',
      category: 'squad',
      tier: 'bronze',
      icon: '🛡️',
      unlocked: hasSquad,
      progressText: hasSquad ? 'Squad created' : '0/1 squad active',
      progressPercent: hasSquad ? 100 : 0,
      unlockedAtLabel: hasSquad ? 'Active Season' : undefined,
    },
    {
      id: 'century-club',
      title: 'Century Club',
      description: 'Accumulate 100 or more total fantasy points in active competition.',
      category: 'performance',
      tier: 'bronze',
      icon: '⚡',
      unlocked: totalPoints >= 100,
      progressText: `${Math.min(totalPoints, 100)}/100 points`,
      progressPercent: Math.min(100, Math.round((totalPoints / 100) * 100)),
      unlockedAtLabel: totalPoints >= 100 ? `${totalPoints} pts scored` : undefined,
    },
    {
      id: 'captain-hit',
      title: 'Captain Hit',
      description: 'Captain delivers standout impact with 20+ points in a single gameweek.',
      category: 'performance',
      tier: 'silver',
      icon: '👑',
      // Unlocked if user has earned over 20 points with an active squad
      unlocked: hasSquad && totalPoints >= 20,
      progressText: hasSquad && totalPoints >= 20 ? 'Milestone achieved' : 'Set captain for next GW',
      progressPercent: hasSquad && totalPoints >= 20 ? 100 : Math.min(90, Math.round((totalPoints / 20) * 100)),
      unlockedAtLabel: hasSquad && totalPoints >= 20 ? 'Leader locked' : undefined,
    },
    {
      id: 'value-hunter',
      title: 'Value Hunter',
      description: 'Scout emerging talent and profit from player price appreciation ($1M+).',
      category: 'squad',
      tier: 'silver',
      icon: '📈',
      unlocked: hasSquad && totalPoints >= 50,
      progressText: hasSquad && totalPoints >= 50 ? 'Market edge secured' : 'Trade rising stars',
      progressPercent: hasSquad && totalPoints >= 50 ? 100 : (hasSquad ? 50 : 0),
      unlockedAtLabel: hasSquad && totalPoints >= 50 ? 'Market mastery' : undefined,
    },
    {
      id: 'top-1000',
      title: 'Top 1000 Contender',
      description: 'Climb the global fantasy leaderboard and crack the top 1,000 managers.',
      category: 'career',
      tier: 'gold',
      icon: '🏆',
      unlocked: Boolean(globalRank && globalRank > 0 && globalRank <= 1000),
      progressText: globalRank
        ? globalRank <= 1000
          ? `Rank #${globalRank}`
          : `Rank #${globalRank} (Target: ≤ 1000)`
        : 'Awaiting season ranking',
      progressPercent: !globalRank
        ? 0
        : globalRank <= 1000
          ? 100
          : Math.max(10, Math.min(95, Math.round((1000 / globalRank) * 100))),
      unlockedAtLabel: globalRank && globalRank <= 1000 ? `Rank #${globalRank}` : undefined,
    },
    {
      id: 'perfect-gw',
      title: 'Perfect Gameweek',
      description: 'All 5 starting players deliver positive scores without penalty.',
      category: 'performance',
      tier: 'mythic',
      icon: '✨',
      unlocked: hasSquad && totalPoints >= 250,
      progressText: hasSquad && totalPoints >= 250 ? 'Flawless execution' : 'Target: 250+ cumulative pts',
      progressPercent: Math.min(100, Math.round((totalPoints / 250) * 100)),
      unlockedAtLabel: hasSquad && totalPoints >= 250 ? 'Flawless line-up' : undefined,
    },
    {
      id: 'profile-master',
      title: 'Profile Master',
      description: 'Fully populate your manager identity with bio, timezone, and country.',
      category: 'activity',
      tier: 'bronze',
      icon: '🎖️',
      unlocked: profileCompleteCount === 3,
      progressText: `${profileCompleteCount}/3 details completed`,
      progressPercent: Math.round((profileCompleteCount / 3) * 100),
      unlockedAtLabel: profileCompleteCount === 3 ? 'Verified manager' : undefined,
    },
  ];
}

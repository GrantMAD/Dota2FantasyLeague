export interface TourStep {
  title: string;
  body: string;
  targetKey: string;
  scrollIntoView?: boolean;
}

export interface PageTourDefinition {
  pageTitle: string;
  steps: TourStep[];
}

export const pageTours: Record<string, PageTourDefinition> = {
  '/dashboard': {
    pageTitle: 'Dashboard',
    steps: [
      { title: 'Your Fantasy HQ', body: 'This is your personal command centre — squad value, bank balance, live rank, and active gameweek at a glance.', targetKey: 'dashboard-stats' },
      { title: 'Active Gameweek', body: 'This panel shows the current gameweek window, deadline, and next scheduled match.', targetKey: 'dashboard-gameweek' },
      { title: 'Quick Actions', body: 'Jump directly to the most common actions — set lineup, make transfers, or view the leaderboard.', targetKey: 'dashboard-actions' },
    ],
  },
  '/squads': {
    pageTitle: 'Squad Overview',
    steps: [
      { title: 'Your Fantasy Pitch', body: 'Your five starting players laid out by role across the Dota 2 position map.', targetKey: 'squad-pitch' },
      { title: 'Player Cards', body: 'Each card shows player name, pro team badge, fantasy role, current price, and Captain / Vice-Captain markers.', targetKey: 'squad-first-player' },
      { title: 'Bench Substitutes', body: 'Three bench players automatically replace starters who do not play in an eligible match during the gameweek.', targetKey: 'squad-bench' },
      { title: 'Team Actions', body: 'Use Make Transfers to trade players and Edit Lineup to reassign starters, captaincy, and bench slots.', targetKey: 'squad-actions' },
    ],
  },
  '/lineups': {
    pageTitle: 'Lineup & Captaincy',
    steps: [
      { title: 'Starter Slots', body: 'Assign each of your five starters to a slot — Carry, Mid, Offlane, Support, Hard Support.', targetKey: 'lineup-starters' },
      { title: 'Captain & Vice-Captain', body: 'Your Captain earns double fantasy points. Vice-Captain steps up if the Captain does not play.', targetKey: 'lineup-captain-controls' },
      { title: 'Bench Slots', body: 'Fill three bench slots. Bench players sub in automatically for absent starters.', targetKey: 'lineup-bench' },
      { title: 'Seasonal Chips', body: 'Activate one-use chips — Triple Captain (3x), Bench Boost (full bench points), or Wildcard (free unlimited transfers).', targetKey: 'lineup-chips' },
      { title: 'Save Your Lineup', body: 'Hit Save Lineup before the gameweek deadline. All changes lock once the deadline passes.', targetKey: 'lineup-save-btn' },
    ],
  },
  '/transfers': {
    pageTitle: 'Transfer Market',
    steps: [
      { title: 'Search & Filter', body: 'Search box and role / team filters narrow the player pool. Toggle My Squad at Top to pin owned players.', targetKey: 'transfers-search' },
      { title: 'Player Table', body: 'Each row shows price, role, pro team, form score, and ownership %; click any row for the full player profile.', targetKey: 'transfers-table' },
      { title: 'Execute a Transfer', body: 'Select a player to sell and a player to buy, then confirm. One free transfer per gameweek — extras cost 4 points.', targetKey: 'transfers-action' },
    ],
  },
  '/players': {
    pageTitle: 'Players Directory',
    steps: [
      { title: 'Search Players', body: 'Type a player name, IGN, or team name to locate any professional Dota 2 athlete in the database.', targetKey: 'players-search' },
      { title: 'Role & Team Filters', body: 'Use role pills and team dropdown to filter by position and pro organisation.', targetKey: 'players-filters' },
      { title: 'Squad Pinning', body: 'Toggle My Squad at Top to pin owned players with an In Squad highlight.', targetKey: 'players-squad-pin' },
      { title: 'Open a Profile', body: 'Click any row to open the full performance profile with career stats, averages, and price history.', targetKey: 'players-table-row' },
    ],
  },
  '/players/[id]': {
    pageTitle: 'Player Profile',
    steps: [
      { title: 'Player Identity', body: 'Name, IGN, pro team, role, fantasy price, and ownership percentage.', targetKey: 'player-hero' },
      { title: 'Performance Stats', body: 'Fantasy average PPM, KDA, GPM, XPM, and role-adjusted contributions.', targetKey: 'player-stats' },
      { title: 'Match History', body: 'Recent match-by-match fantasy point breakdown. Assess form before making a transfer decision.', targetKey: 'player-history' },
    ],
  },
  '/leagues': {
    pageTitle: 'Leagues & Communities',
    steps: [
      { title: 'Your Leagues', body: 'All leagues you are a member of — current rank, points total, and league format.', targetKey: 'leagues-my-leagues' },
      { title: 'Create a League', body: 'Start a private or public league. Choose Classic (total points) or Head-to-Head (weekly fixtures).', targetKey: 'leagues-create' },
      { title: 'Join with a Code', body: 'Enter an invite code shared by a friend to join their private league.', targetKey: 'leagues-join' },
      { title: 'League Detail', body: 'Click any league card to see full standings, fixture schedule (H2H), and member list.', targetKey: 'leagues-card' },
    ],
  },
  '/leaderboard': {
    pageTitle: 'Global Leaderboard',
    steps: [
      { title: 'Global Rankings', body: 'Every registered manager ranked by total fantasy points across all closed gameweeks.', targetKey: 'leaderboard-table' },
      { title: 'Your Position', body: 'Your entry is highlighted with a teal accent row so you can instantly spot your global rank.', targetKey: 'leaderboard-you-row' },
      { title: 'Country Filter', body: 'Filter by country to see regional rankings instead of the global list.', targetKey: 'leaderboard-filter' },
    ],
  },
  '/gameweeks': {
    pageTitle: 'Gameweeks',
    steps: [
      { title: 'Active Gameweek', body: 'The currently open gameweek — lock deadline, status, and which matches count toward scoring.', targetKey: 'gameweeks-active' },
      { title: 'Deadline Timer', body: 'Countdown showing exactly how long to finalise your lineup before changes lock.', targetKey: 'gameweeks-deadline' },
      { title: 'Past Gameweeks', body: 'Review completed gameweeks — click any to see the full match log and scoring breakdown.', targetKey: 'gameweeks-history' },
    ],
  },
  '/gameweeks/[id]': {
    pageTitle: 'Gameweek Detail',
    steps: [
      { title: 'Gameweek Summary', body: 'Total fantasy points, eligible match count, and whether the gameweek is closed.', targetKey: 'gwdetail-summary' },
      { title: 'Match List', body: 'Each match card shows teams, result, duration, tournament, and links to the full match detail page.', targetKey: 'gwdetail-matches' },
      { title: 'Back Navigation', body: 'Use the breadcrumb at the top to return to the full gameweek list.', targetKey: 'gwdetail-breadcrumb' },
    ],
  },
  '/matches': {
    pageTitle: 'Matches',
    steps: [
      { title: 'Match Cards', body: 'Competing pro teams, match status, tournament name, and scheduled date.', targetKey: 'matches-first-card' },
      { title: 'Status Indicators', body: 'The coloured badge tells you if a match is live, completed and scored, or upcoming.', targetKey: 'matches-status' },
      { title: 'Match Detail', body: 'Click any card to open the full detail page with draft picks, result, duration, and fantasy score contributions.', targetKey: 'matches-open' },
    ],
  },
  '/matches/[id]': {
    pageTitle: 'Match Detail',
    steps: [
      { title: 'Match Header', body: 'Tournament, date, format, and gameweek association alongside a back-navigation breadcrumb.', targetKey: 'matchdetail-header' },
      { title: 'Teams & Result', body: 'Both competing teams with logos, player rosters, and the final match result.', targetKey: 'matchdetail-teams' },
      { title: 'Player Scores', body: 'Individual fantasy point contributions per player — kills, assists, objectives, and bonuses.', targetKey: 'matchdetail-scores' },
    ],
  },
  '/tournaments': {
    pageTitle: 'Pro Tournaments',
    steps: [
      { title: 'Tournament Cards', body: 'Tournament name, tier, status, and period covered. Only eligible tournaments count toward fantasy scoring.', targetKey: 'tournaments-first-card' },
      { title: 'Tier Badge', body: 'The tier badge indicates prestige and player pool size. Tier 1 features the world’s top teams.', targetKey: 'tournaments-tier' },
      { title: 'Tournament Detail', body: 'Click a card to see all matches within the tournament, filterable by team and date.', targetKey: 'tournaments-open' },
    ],
  },
  '/tournaments/[id]': {
    pageTitle: 'Tournament Detail',
    steps: [
      { title: 'Overview', body: 'Review tournament dates, status, and the matches that count toward your fantasy season.', targetKey: 'tournament-detail-overview' },
      { title: 'Match Feed', body: 'Browse the relevant match cards inside the event, sorted by date and stage.', targetKey: 'tournament-detail-matches' },
      { title: 'Context Links', body: 'Open any match for a deeper result and player fantasy scoring breakdown.', targetKey: 'tournament-detail-cards' },
    ],
  },
  '/analytics': {
    pageTitle: 'Analytics',
    steps: [
      { title: 'Headline Metrics', body: 'Read the main performance indicators and compare your squad efficiency at a glance.', targetKey: 'analytics-summary' },
      { title: 'Trend Breakdown', body: 'Review category-specific metrics for ownership, volume, and contribution trends.', targetKey: 'analytics-trend' },
      { title: 'Premium Insights', body: 'Use advanced analytic tools when your account has premium access enabled.', targetKey: 'analytics-premium' },
    ],
  },
  '/profile': {
    pageTitle: 'Manager Profile',
    steps: [
      { title: 'Identity', body: 'Review your display name, username, and shortlist of profile details.', targetKey: 'profile-header' },
      { title: 'Career Stats', body: 'Check your fantasy career statistics, historical totals, and recent performance.', targetKey: 'profile-stats' },
      { title: 'Settings', body: 'Open Settings to edit profile details and account preferences.', targetKey: 'profile-settings' },
    ],
  },
  '/account': {
    pageTitle: 'Account',
    steps: [
      { title: 'Username & identity', body: 'Review or update your username and account identity details.', targetKey: 'account-header' },
      { title: 'Regional settings', body: 'Set country and timezone so date and match windows remain accurate.', targetKey: 'account-settings' },
      { title: 'Password control', body: 'Use password reset when you need new credentials or account access recovery.', targetKey: 'account-actions' },
    ],
  },
  '/settings': {
    pageTitle: 'Settings',
    steps: [
      { title: 'Profile settings', body: 'Update headline profile information and account identity fields.', targetKey: 'settings-profile' },
      { title: 'Appearance', body: 'Choose your preferred dark or light visual mode and interface preferences.', targetKey: 'settings-appearance' },
      { title: 'Notifications', body: 'Manage email and push notification delivery preferences for your account.', targetKey: 'settings-notifications' },
    ],
  },
  '/notifications': {
    pageTitle: 'Notifications',
    steps: [
      { title: 'Inbox', body: 'Read unread notifications and catch deadline or roster updates quickly.', targetKey: 'notifications-list' },
      { title: 'Mark as read', body: 'Use item actions to clear specific notifications without refreshing the page.', targetKey: 'notifications-item' },
      { title: 'Bulk tidy-up', body: 'Use the global Mark all as read option to clear the list in one click.', targetKey: 'notifications-actions' },
    ],
  },
  '/premium': {
    pageTitle: 'Premium',
    steps: [
      { title: 'Package overview', body: 'Review the available features and compare free versus premium benefits.', targetKey: 'premium-overview' },
      { title: 'Plan comparison', body: 'Compare included premium passes and advanced tools before upgrading.', targetKey: 'premium-plans' },
      { title: 'Upgrade action', body: 'Choose an upgrade or waitlist action when the feature is available.', targetKey: 'premium-action' },
    ],
  },
  '/help': {
    pageTitle: 'Help Center',
    steps: [
      { title: 'FAQ browse', body: 'Browse the frequently asked questions and operational guidance.', targetKey: 'help-faq' },
      { title: 'Role guidance', body: 'Read the role eligibility and roster-rule content for squad management.', targetKey: 'help-rules' },
      { title: 'Support', body: 'Use support options for unresolved issues or edge-case questions.', targetKey: 'help-support' },
    ],
  },
  '/rules': {
    pageTitle: 'Rules & Scoring',
    steps: [
      { title: 'Squad rules', body: 'Understand squad composition, role requirements, and roster constraints.', targetKey: 'rules-overview' },
      { title: 'Scoring logic', body: 'Review the points system for kills, assists, objectives, and role bonuses.', targetKey: 'rules-scoring' },
      { title: 'Chips & deadlines', body: 'Check transfer, deadline, and chip rules before setting your lineup.', targetKey: 'rules-chips' },
    ],
  },
};

export function getPageTour(pathname: string): PageTourDefinition | undefined {
  const normalized = pathname.split('?')[0].split('#')[0] || '/';

  const direct = pageTours[normalized];
  if (direct) return direct;

  if (normalized === '/players') return pageTours['/players'];
  if (/^\/players\/[^/]+$/.test(normalized)) return pageTours['/players/[id]'];
  if (/^\/gameweeks\/[^/]+$/.test(normalized)) return pageTours['/gameweeks/[id]'];
  if (/^\/matches\/[^/]+$/.test(normalized)) return pageTours['/matches/[id]'];
  if (/^\/tournaments\/[^/]+$/.test(normalized)) return pageTours['/tournaments/[id]'];

  return undefined;
}

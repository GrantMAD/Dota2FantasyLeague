export interface PageGuide {
  overview: string;
  steps: string[];
  implications: string;
  tips: string[];
  related: Array<{ label: string; href: string }>;
}

const guides: Record<string, PageGuide> = {
  '/guide': {
    overview: 'The Guide directory groups page walkthroughs by team management, competition, and account or insight topics.',
    steps: [
      'Choose a category or search for a page or feature.',
      'Select a guide card to navigate to that page and open its detailed guide.',
      'From the destination guide, start its highlighted tour when you want an on-screen walkthrough.',
    ],
    implications: 'Browsing the directory does not change your team or account. Opening a guide is informational; choosing a related action or tour moves you to the relevant page without completing or changing fantasy actions.',
    tips: ['Search by a page name or action such as captain, transfer, or deadline.', 'Use the Rules page for authoritative scoring and roster requirements.'],
    related: [{ label: 'Learn hub', href: '/learn' }, { label: 'Rules and scoring', href: '/rules' }, { label: 'Help center', href: '/help' }],
  },
  '/learn': {
    overview: 'The Learn hub brings together the Interactive Guide, Rules and Scoring, and quick references for common fantasy tasks.',
    steps: [
      'Choose whether you need page instructions, game rules, or a quick reference.',
      'Follow a workflow link to the relevant squad, lineup, transfer, or gameweek page.',
      'Read the linked page guide before making consequential changes.',
    ],
    implications: 'Learning content is informational. Actions taken through its links occur on the destination page and are subject to that page’s deadlines, budget, and scoring rules.',
    tips: ['Use the Guide for page-by-page instructions and the Rules page for complete mechanics.', 'Check the active gameweek deadline before changing lineups or transfers.'],
    related: [{ label: 'Interactive guide', href: '/guide' }, { label: 'Rules and scoring', href: '/rules' }, { label: 'Gameweeks', href: '/gameweeks' }],
  },
  '/dashboard': {
    overview: 'Use the dashboard to check your fantasy status and decide what needs attention before the next deadline.',
    steps: [
      'Review your squad value, bank balance, total points, rank, and free transfers in the summary cards.',
      'Check the active gameweek, its deadline, and the next scheduled match.',
      'Choose a quick action to set your lineup, make transfers, or compare your standing.',
    ],
    implications: 'The dashboard is a summary and navigation hub. Changes made in Lineups or Transfers update the squad and fantasy totals shown here; the dashboard itself does not change your team.',
    tips: ['Check the deadline before making lineup or transfer decisions.', 'Use the squad preview to spot missing starters or captaincy choices.'],
    related: [{ label: 'Set your lineup', href: '/lineups' }, { label: 'Transfer market', href: '/transfers' }, { label: 'Gameweeks', href: '/gameweeks' }],
  },
  '/squads': {
    overview: 'The squad page is the overview of the players you own, their roles, prices, and current starting or reserve assignments.',
    steps: [
      'Review your five starters on the pitch and confirm each player covers the required role.',
      'Check player availability, team, role, and current price; open a player profile for more performance context.',
      'Review your bench and use the lineup or transfer actions to make changes.',
    ],
    implications: 'Transfers change squad membership, budget, and the players available in your lineup. Lineup assignments and captaincy affect gameweek scoring; changes lock at the deadline.',
    tips: ['A complete squad and a valid starting five are separate checks.', 'Review availability and the upcoming schedule before choosing starters.'],
    related: [{ label: 'Edit lineup', href: '/lineups' }, { label: 'Transfer market', href: '/transfers' }, { label: 'Players directory', href: '/players' }],
  },
  '/lineups': {
    overview: 'Set the five starting roles, captaincy, and optional bench before the active gameweek deadline.',
    steps: [
      'Assign eligible squad players to Carry, Mid, Offlane, Support, and Hard Support; Support players can cover either support slot.',
      'Choose a captain and vice-captain from the starting five, then optionally assign up to three bench players.',
      'Review any available chip and its effect, then save the lineup before the deadline.',
    ],
    implications: 'The captain earns the applicable captain multiplier and lineup choices determine who contributes to your gameweek score. An activated chip can change scoring or transfer rules and may be limited-use. Once the deadline passes, lineup changes are locked.',
    tips: ['Check that each starter is eligible for its role and that no player is assigned twice.', 'Read the chip description before activating it; a chip may be difficult or impossible to undo.'],
    related: [{ label: 'Rules and scoring', href: '/rules' }, { label: 'Gameweek deadlines', href: '/gameweeks' }, { label: 'Manage squad', href: '/squads' }],
  },
  '/transfers': {
    overview: 'Use the transfer market to replace squad players while managing your budget and gameweek transfer allowance.',
    steps: [
      'Search or filter the available player pool by name, role, team, or other visible criteria.',
      'Select a player to sell and a replacement to buy, and review both prices and your remaining budget.',
      'Review the transfer confirmation, including any applicable point cost, before submitting it.',
    ],
    implications: 'A completed transfer changes your squad membership and bank balance, and the new player becomes available for lineup selection. Transfers can affect your gameweek score through any applicable transfer penalty and may be restricted after the deadline.',
    tips: ['Verify the final balance and transfer cost on the confirmation before committing.', 'Check player availability and eligible matches, not only recent form.'],
    related: [{ label: 'Squad overview', href: '/squads' }, { label: 'Set lineup', href: '/lineups' }, { label: 'Rules and scoring', href: '/rules' }],
  },
  '/players': {
    overview: 'Browse professional players and compare the information available before selecting a player for your squad.',
    steps: [
      'Search by player name or in-game name to narrow the directory.',
      'Use role and team filters to focus on players who fit your squad needs.',
      'Open a player profile to inspect performance information and match history.',
    ],
    implications: 'Browsing and filtering do not change your squad. Adding or replacing a player happens through the transfer flow and may affect your budget, transfer allowance, and lineup options.',
    tips: ['Compare role, price, availability, and recent performance together.', 'Use the squad filter or transfer market to confirm whether a player is already owned.'],
    related: [{ label: 'Transfer market', href: '/transfers' }, { label: 'Squad overview', href: '/squads' }, { label: 'Rules and scoring', href: '/rules' }],
  },
  '/players/[id]': {
    overview: 'A player profile brings together identity, role, price, fantasy performance, and available match history.',
    steps: [
      'Confirm the player name, team, role, and current fantasy price.',
      'Review the performance metrics and scoring history, noting the time period shown.',
      'Use the recent match information to add context before making a squad decision.',
    ],
    implications: 'Viewing a profile is read-only. A transfer based on this information changes squad membership, budget, and potentially transfer points; historical performance does not guarantee future results.',
    tips: ['Compare like-for-like roles and check availability before deciding.', 'Treat averages and recent form as context rather than a promise of future points.'],
    related: [{ label: 'All players', href: '/players' }, { label: 'Transfer market', href: '/transfers' }, { label: 'Rules and scoring', href: '/rules' }],
  },
  '/leagues': {
    overview: 'Create or join a league to compare your fantasy performance with a selected group of managers.',
    steps: [
      'Review the leagues you already belong to and their format.',
      'To create a league, choose its name and format; to join a private league, enter a valid invitation code.',
      'Open a league to review standings, members, and any available fixtures.',
    ],
    implications: 'Creating a league establishes a competition for its members; joining associates your team with that competition. League standings follow fantasy scoring and may update after gameweek results are recalculated.',
    tips: ['Confirm the league format before creating it.', 'Share private invite codes only with the people you intend to join.'],
    related: [{ label: 'Global leaderboard', href: '/leaderboard' }, { label: 'Gameweeks', href: '/gameweeks' }],
  },
  '/leaderboard': {
    overview: 'The leaderboard compares manager standings using the fantasy points recorded by the app.',
    steps: [
      'Review the ranking and points columns to compare managers.',
      'Use the country filter, when available, to narrow the ranking to a region.',
      'Check the displayed refresh information to understand when standings were last recalculated.',
    ],
    implications: 'The leaderboard is read-only. Your rank changes when your recorded points or other managers’ points change; it does not independently modify league standings or your lineup.',
    tips: ['Use league pages for competition-specific standings.', 'Allow for scoring and ranking recalculations after matches finish.'],
    related: [{ label: 'Your leagues', href: '/leagues' }, { label: 'Gameweeks', href: '/gameweeks' }, { label: 'Scoring rules', href: '/rules' }],
  },
  '/gameweeks': {
    overview: 'Gameweeks group eligible matches into fantasy scoring periods and show the deadlines that control lineup changes.',
    steps: [
      'Identify the active gameweek and check its status and deadline.',
      'Use the deadline information to plan when to finish lineup and transfer actions.',
      'Open a completed gameweek to review its matches and available scoring history.',
    ],
    implications: 'The active gameweek determines which matches contribute to the relevant fantasy total. After its deadline, lineup changes are locked; completed gameweek data can feed totals, rankings, and league standings.',
    tips: ['Deadlines use the app’s displayed time; check your local timezone.', 'Make final changes before the deadline rather than relying on last-minute updates.'],
    related: [{ label: 'Set lineup', href: '/lineups' }, { label: 'Transfer market', href: '/transfers' }, { label: 'Rules and scoring', href: '/rules' }],
  },
  '/gameweeks/[id]': {
    overview: 'A gameweek detail page shows the matches and scoring context associated with one scoring period.',
    steps: [
      'Review the gameweek status and summary before interpreting the points.',
      'Browse its match list and open a match for more detail where available.',
      'Return to the gameweek index to compare another scoring period.',
    ],
    implications: 'This page is primarily informational. Match and score records contribute to gameweek totals and may subsequently update manager rankings and league standings.',
    tips: ['A result may appear before all fantasy scoring updates have completed.', 'Use the match detail page when you need the underlying performance context.'],
    related: [{ label: 'All gameweeks', href: '/gameweeks' }, { label: 'Matches', href: '/matches' }, { label: 'Leaderboard', href: '/leaderboard' }],
  },
  '/matches': {
    overview: 'Browse professional matches and their status, tournament context, and fantasy gameweek association.',
    steps: [
      'Review match status and scheduled timing to find upcoming or completed matches.',
      'Use available filters to narrow the displayed match list.',
      'Open a match to see its result and any available player-level details.',
    ],
    implications: 'The match list is read-only. Eligible match results and player performances may be used by scoring jobs to update fantasy points, gameweek totals, and rankings.',
    tips: ['A match marked complete may still be awaiting detailed stats or fantasy recalculation.', 'Check the associated gameweek to understand which scoring period includes a match.'],
    related: [{ label: 'Gameweeks', href: '/gameweeks' }, { label: 'Tournaments', href: '/tournaments' }, { label: 'Leaderboard', href: '/leaderboard' }],
  },
  '/matches/[id]': {
    overview: 'Inspect a specific match, its teams and result, and the player scoring information available for it.',
    steps: [
      'Check the match header for tournament and gameweek context.',
      'Review both teams and the recorded result.',
      'Inspect player-level performance and fantasy score details when they are available.',
    ],
    implications: 'This page does not change your team. Match data can feed player fantasy points, gameweek totals, and later leaderboard or league recalculations.',
    tips: ['Detailed player statistics may be unavailable until the match data pipeline finishes.', 'Use the gameweek link to see the broader scoring-period context.'],
    related: [{ label: 'All matches', href: '/matches' }, { label: 'Gameweeks', href: '/gameweeks' }, { label: 'Tournaments', href: '/tournaments' }],
  },
  '/tournaments': {
    overview: 'Explore professional tournaments and identify the events and matches represented in the fantasy data.',
    steps: [
      'Review each event’s name, dates, tier, and status.',
      'Open an event to inspect its matches and schedule.',
      'Follow a match link for its result and available player scoring details.',
    ],
    implications: 'Tournament pages are informational. Only matches eligible under the fantasy rules affect fantasy scoring; tournament visibility alone does not guarantee a match is score-eligible.',
    tips: ['Use the rules page to confirm which competitions and matches count.', 'Match schedules and statuses can change as provider data updates.'],
    related: [{ label: 'Tournament rules', href: '/rules' }, { label: 'Matches', href: '/matches' }, { label: 'Gameweeks', href: '/gameweeks' }],
  },
  '/tournaments/[id]': {
    overview: 'A tournament detail page gathers information and match listings for one event.',
    steps: [
      'Review the event status and date information.',
      'Browse the associated matches and their current status.',
      'Open an individual match for results and player-level details.',
    ],
    implications: 'This page is read-only. Eligible match data can contribute to fantasy points and gameweek totals after scoring is processed.',
    tips: ['Check match eligibility in the rules; not every event necessarily contributes points.', 'Use match details to verify the context behind a score.'],
    related: [{ label: 'All tournaments', href: '/tournaments' }, { label: 'Matches', href: '/matches' }, { label: 'Rules and scoring', href: '/rules' }],
  },
  '/analytics': {
    overview: 'Analytics summarizes available fantasy and player data to help you interpret trends and compare performance.',
    steps: [
      'Start with headline metrics and note the data period they cover.',
      'Compare trends and breakdowns to identify potential strengths or gaps.',
      'Use any premium-only insight only if your account has access to it.',
    ],
    implications: 'Analytics is informational and does not automatically change your lineup or transfers. Decisions made from it can affect budget, transfer usage, and points if you act elsewhere.',
    tips: ['Check sample size and recency before relying on a trend.', 'Use player profiles and rules to understand the underlying statistics.'],
    related: [{ label: 'Players', href: '/players' }, { label: 'Transfers', href: '/transfers' }, { label: 'Premium tools', href: '/premium' }],
  },
  '/profile': {
    overview: 'Your manager profile presents your identity and fantasy activity in the app.',
    steps: [
      'Review your display name and other visible profile information.',
      'Check your fantasy statistics and competition context.',
      'Open Settings to update supported account and profile details.',
    ],
    implications: 'Profile edits change the identity information shown in relevant app surfaces. They do not directly alter your fantasy squad, points, or league membership.',
    tips: ['Use Settings for editable preferences and account fields.', 'Only share information you are comfortable displaying to other managers.'],
    related: [{ label: 'Settings', href: '/settings' }, { label: 'Leagues', href: '/leagues' }, { label: 'Leaderboard', href: '/leaderboard' }],
  },
  '/account': {
    overview: 'The account page provides access to your account settings and account-related actions.',
    steps: [
      'Review the account details shown on the page.',
      'Follow the link to the relevant Settings section to update supported fields.',
      'Use the password recovery flow if you need to change or regain access to your password.',
    ],
    implications: 'Account and security changes can affect how you sign in and how your profile appears. They do not change fantasy scoring or squad membership.',
    tips: ['Keep access to your registered email address for recovery.', 'Use the Settings page for current account controls.'],
    related: [{ label: 'Settings', href: '/settings?section=account' }, { label: 'Password recovery', href: '/forgot-password' }],
  },
  '/settings': {
    overview: 'Settings contains your editable profile, appearance, notification, and account preferences.',
    steps: [
      'Choose a section from the settings navigation.',
      'Review each field or preference before saving changes.',
      'Check the confirmation message after a save; unavailable delivery options remain disabled.',
    ],
    implications: 'Profile and theme preferences affect how your account is presented and how the app appears. In-app notifications remain available; email and device push are not configured, so their disabled controls do not change delivery.',
    tips: ['Changes to account details can affect how other app pages identify you.', 'Use the Notifications section for availability information on delivery channels.'],
    related: [{ label: 'Notifications', href: '/settings?section=notifications' }, { label: 'Profile', href: '/profile' }, { label: 'Notification center', href: '/notifications' }],
  },
  '/notifications': {
    overview: 'The notification center collects in-app alerts about deadlines, scoring, leagues, and other fantasy activity.',
    steps: [
      'Choose a category or unread filter to focus the list.',
      'Open a notification’s destination link for the relevant lineup, match, or competition.',
      'Mark individual or all notifications as read; use Clear read only when you intend to remove read items.',
    ],
    implications: 'Marking an alert read changes its read status, not the underlying lineup, score, transfer, or league result. Clearing read notifications removes those notifications from your center. Email and device-push delivery are not currently configured.',
    tips: ['Use the deadline category to find time-sensitive lineup reminders.', 'In-app alerts work independently of the disabled email and push controls.'],
    related: [{ label: 'Notification preferences', href: '/settings?section=notifications' }, { label: 'Lineups', href: '/lineups' }, { label: 'Gameweeks', href: '/gameweeks' }],
  },
  '/premium': {
    overview: 'The Premium page explains additional tools and access options available in the app.',
    steps: [
      'Review each listed benefit and its current availability.',
      'Compare the stated access requirements before choosing an action.',
      'Use the displayed upgrade or waitlist action only when it is available.',
    ],
    implications: 'Premium access can change which tools are available to your account, but it does not automatically change your fantasy lineup or score.',
    tips: ['Check current availability and terms rather than assuming a feature is active.', 'Use the standard player and transfer pages when a premium tool is unavailable.'],
    related: [{ label: 'Analytics', href: '/analytics' }, { label: 'Players', href: '/players' }, { label: 'Help', href: '/help' }],
  },
  '/help': {
    overview: 'The Help Center answers common questions and points to guidance for roles, scoring, and support.',
    steps: [
      'Browse the topic or question related to what you need.',
      'Check the role and scoring guidance for fantasy-specific rules.',
      'Use the available support route if the published guidance does not resolve your issue.',
    ],
    implications: 'Help content is informational. Any lineup, transfer, or account change must be made on its respective page and remains subject to its rules and deadlines.',
    tips: ['Check the Rules page for the authoritative scoring and deadline details.', 'Include the page and action involved when reporting a problem.'],
    related: [{ label: 'Rules and scoring', href: '/rules' }, { label: 'Guide directory', href: '/guide' }, { label: 'Settings', href: '/settings' }],
  },
  '/rules': {
    overview: 'The Rules page explains squad construction, scoring, deadlines, transfers, and other fantasy mechanics.',
    steps: [
      'Use the topic navigation to find the rule relevant to your decision.',
      'Read the full rule and any exceptions before changing your lineup or using a chip.',
      'Return to the relevant fantasy page to take the action under those rules.',
    ],
    implications: 'Rules determine whether players and matches are eligible, how actions affect budget and points, and when changes lock. The Rules page itself is read-only.',
    tips: ['Check deadlines before acting; locked actions may not be editable afterward.', 'Use the scoring section to understand how match performance affects fantasy points.'],
    related: [{ label: 'Lineups', href: '/lineups' }, { label: 'Transfers', href: '/transfers' }, { label: 'Gameweeks', href: '/gameweeks' }],
  },
};

export function getPageGuideKey(pathname: string): string | undefined {
  const normalized = pathname.split('?')[0].split('#')[0] || '/';
  if (guides[normalized]) return normalized;
  if (/^\/players\/[^/]+$/.test(normalized)) return '/players/[id]';
  if (/^\/gameweeks\/[^/]+$/.test(normalized)) return '/gameweeks/[id]';
  if (/^\/matches\/[^/]+$/.test(normalized)) return '/matches/[id]';
  if (/^\/tournaments\/[^/]+$/.test(normalized)) return '/tournaments/[id]';
  return undefined;
}

export function getPageGuide(pathname: string): PageGuide | undefined {
  const key = getPageGuideKey(pathname);
  return key ? guides[key] : undefined;
}

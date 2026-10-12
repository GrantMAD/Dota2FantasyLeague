export type HeaderProfile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role?: string | null;
};

export type HeaderNotification = {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export type QuickStats = {
  bankBalance: number;
  freeTransfers: number;
  globalRank: number | null;
  totalPoints: number;
  gameweek: {
    gameweek_number: number;
    deadline: string;
    status: string;
  } | null;
};

export type SearchResultItem = {
  id: string | number;
  title: string;
  subtitle: string;
  category: 'Players' | 'Navigation' | 'Pages';
  href: string;
  badge?: string;
};

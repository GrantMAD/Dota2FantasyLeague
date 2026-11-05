export const SQUAD_MAX_SIZE = 8;
export const STARTER_ROLES = ['Carry', 'Mid', 'Offlane', 'Support', 'Hard Support'] as const;
export type StarterRole = typeof STARTER_ROLES[number];
export const ROLE_ACCENTS: Record<string, string> = {
  Carry: 'var(--danger)',
  Mid: 'var(--accent-secondary)',
  Offlane: 'var(--accent-primary)',
  Support: 'var(--success)',
  'Hard Support': '#a78bfa',
};

export type TransferSortBy = 'price' | 'name' | 'points' | 'ownership';
export type TransferOwnershipFilter = 'all' | 'owned' | 'available';

export interface TransferSuggestion {
  player_out_id: number;
  player_out_name: string;
  player_out_role: string;
  player_out_recent_points: number[];
  player_out_price_change: number | null;
  player_in_id: number;
  player_in_name: string;
  player_in_role: string;
  player_in_current_price: number;
  player_in_recent_points: number[];
  player_in_price_change: number | null;
  budget_after: number;
  reasons: string[];
}

export interface TransferSuggestionSummary {
  status: string;
  completed_gameweeks: number;
  required_gameweeks: number;
  priced_role_matched_candidates: number;
}

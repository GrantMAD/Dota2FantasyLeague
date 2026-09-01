/**
 * Maps known Supabase/Postgres error codes and patterns to
 * human-readable messages. Never exposes raw DB errors to users.
 */

interface FriendlyErrorMap {
  [key: string]: string;
}

const POSTGRES_ERROR_MAP: FriendlyErrorMap = {
  // Constraint violations
  '23505': 'This item already exists. Please check for duplicates.',
  '23503': 'A related record could not be found.',
  '23514': 'The provided values are not valid for this operation.',
  // Auth
  '42501': 'You do not have permission to perform this action.',
  // General
  'PGRST301': 'Your session has expired. Please sign in again.',
  'PGRST116': 'The requested record was not found.',
};

const DOMAIN_ERROR_MAP: FriendlyErrorMap = {
  'transfers_closed': 'Transfers are closed for this gameweek.',
  'insufficient_budget': 'You do not have enough budget for this transfer.',
  'player_already_in_squad': 'This player has already been added to your squad.',
  'player_not_eligible': 'This player is not eligible for your selected position.',
  'league_full': 'This league is full.',
  'invalid_lineup': 'Your lineup is not valid. Ensure all positions are filled.',
  'chip_already_used': 'You have already used this chip this season.',
  'no_upcoming_gameweek': 'No upcoming gameweek is available for this action.',
  'match_data_processing': 'The match data is still being processed. Please try again shortly.',
  'deadline_passed': 'The deadline for this gameweek has passed.',
};

/**
 * Returns a friendly error message for an API error.
 * Accepts a Supabase error object, a domain key, or a raw message.
 */
export function getFriendlyError(
  error: { code?: string; message?: string } | string | null,
  domainKey?: keyof typeof DOMAIN_ERROR_MAP
): string {
  // Check domain key first (most specific)
  if (domainKey && DOMAIN_ERROR_MAP[domainKey]) {
    return DOMAIN_ERROR_MAP[domainKey];
  }

  if (typeof error === 'string') {
    // Check if the string is a known domain key
    if (DOMAIN_ERROR_MAP[error]) return DOMAIN_ERROR_MAP[error];
    return error;
  }

  if (error?.code && POSTGRES_ERROR_MAP[error.code]) {
    return POSTGRES_ERROR_MAP[error.code];
  }

  return 'An unexpected error occurred. Please try again.';
}

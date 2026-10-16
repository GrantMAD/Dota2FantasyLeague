export type CountdownParts = {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isUrgent: boolean;
};

export type GameweekViewMode = 'compact' | 'detailed';

const GAMEWEEK_VIEW_MODE_STORAGE_KEY = 'gameweeks-view-mode';
const GAMEWEEK_VIEW_MODE_CHANGE_EVENT = 'gameweeks-view-mode-change';
let fallbackViewMode: GameweekViewMode = 'detailed';

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function subscribeToGameweekViewMode(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === GAMEWEEK_VIEW_MODE_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener('storage', handleStorageChange);
  window.addEventListener(GAMEWEEK_VIEW_MODE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', handleStorageChange);
    window.removeEventListener(GAMEWEEK_VIEW_MODE_CHANGE_EVENT, onChange);
  };
}

export function getStoredGameweekViewMode(
  storage?: Pick<Storage, 'getItem'> | null,
): GameweekViewMode {
  const preferenceStorage = storage === undefined ? getBrowserStorage() : storage;
  if (!preferenceStorage) return fallbackViewMode;
  try {
    const stored = preferenceStorage.getItem(GAMEWEEK_VIEW_MODE_STORAGE_KEY);
    return stored === 'compact' || stored === 'detailed' ? stored : 'detailed';
  } catch {
    return fallbackViewMode;
  }
}

export function getServerGameweekViewMode(): GameweekViewMode {
  return 'detailed';
}

export function saveGameweekViewMode(
  viewMode: GameweekViewMode,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  fallbackViewMode = viewMode;
  const preferenceStorage = storage === undefined ? getBrowserStorage() : storage;
  if (preferenceStorage) {
    try {
      preferenceStorage.setItem(GAMEWEEK_VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // The view preference is best-effort when browser storage is unavailable.
    }
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(GAMEWEEK_VIEW_MODE_CHANGE_EVENT));
}

export function getDeadlineCountdown(deadline: string | Date): CountdownParts {
  const target = new Date(deadline).getTime();
  const now = Date.now();
  const totalMs = Math.max(0, target - now);
  const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((totalMs / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((totalMs / (1000 * 60)) % 60);
  const seconds = Math.floor((totalMs / 1000) % 60);

  return {
    totalMs,
    days,
    hours,
    minutes,
    seconds,
    isUrgent: totalMs > 0 && totalMs <= 24 * 60 * 60 * 1000,
  };
}

export function formatGameweekDate(date: string | Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatGameweekDeadline(deadline: string | Date): string {
  return new Date(deadline).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

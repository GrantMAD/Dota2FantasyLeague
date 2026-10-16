import { getStoredGameweekViewMode, saveGameweekViewMode } from './gameweeks-utils';

describe('gameweek view preference', () => {
  let values: Map<string, string>;
  let storage: Pick<Storage, 'getItem' | 'setItem'>;

  beforeEach(() => {
    values = new Map();
    storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults to detailed view when no valid preference is stored', () => {
    expect(getStoredGameweekViewMode(storage)).toBe('detailed');
    storage.setItem('gameweeks-view-mode', 'unknown');
    expect(getStoredGameweekViewMode(storage)).toBe('detailed');
  });

  it.each(['compact', 'detailed'] as const)('restores and saves the %s preference', (viewMode) => {
    storage.setItem('gameweeks-view-mode', viewMode);
    expect(getStoredGameweekViewMode(storage)).toBe(viewMode);

    const nextMode = viewMode === 'compact' ? 'detailed' : 'compact';
    saveGameweekViewMode(nextMode, storage);
    expect(storage.getItem('gameweeks-view-mode')).toBe(nextMode);
  });

  it('keeps the page usable when browser storage is unavailable', () => {
    const unavailableStorage = {
      getItem: jest.fn(() => {
        throw new Error('storage unavailable');
      }),
      setItem: jest.fn(() => {
        throw new Error('storage unavailable');
      }),
    };
    saveGameweekViewMode('detailed', unavailableStorage);

    expect(getStoredGameweekViewMode(unavailableStorage)).toBe('detailed');
    expect(() => saveGameweekViewMode('compact', unavailableStorage)).not.toThrow();
    expect(unavailableStorage.getItem).toHaveBeenCalled();
    expect(unavailableStorage.setItem).toHaveBeenCalled();
  });
});

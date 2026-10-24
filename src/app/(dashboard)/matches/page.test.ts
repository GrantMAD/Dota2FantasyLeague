import MatchesPage from './page';
import { getInitialMatchesData } from '@/lib/matches-initial-data';

jest.mock('@/lib/matches-initial-data', () => ({
  getInitialMatchesData: jest.fn(),
}));

jest.mock('./MatchesPageClient', () => jest.fn(() => null));

describe('MatchesPage', () => {
  it('renders empty client data and logs when prerender data is unavailable', async () => {
    jest.mocked(getInitialMatchesData).mockRejectedValueOnce(new Error('fetch failed'));
    const logError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const page = await MatchesPage();

    expect(page.props.initialData).toEqual({
      matches: [],
      tournaments: [],
      pagination: { page: 1, limit: 24, total: 0, totalPages: 0 },
      counts: { all: 0, live: 0, upcoming: 0, completed: 0 },
      activeGameweekId: null,
    });
    expect(logError).toHaveBeenCalledWith(
      '[Matches] Failed to load prerendered data; the client will retry:',
      expect.any(Error),
    );
    logError.mockRestore();
  });
});

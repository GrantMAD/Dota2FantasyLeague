import GameweeksPage from './page';
import { getInitialGameweeks } from '@/lib/gameweeks-initial-data';

jest.mock('@/lib/gameweeks-initial-data', () => ({
  getInitialGameweeks: jest.fn(),
}));

jest.mock('./GameweeksPageClient', () => jest.fn(() => null));

describe('GameweeksPage', () => {
  it('renders an empty client seed and logs when prerender data is unavailable', async () => {
    jest.mocked(getInitialGameweeks).mockRejectedValueOnce(new Error('fetch failed'));
    const logError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const page = await GameweeksPage();

    expect(page.props.initialGameweeks).toEqual([]);
    expect(logError).toHaveBeenCalledWith(
      '[Gameweeks] Failed to load prerendered data; the client will retry:',
      expect.any(Error),
    );
    logError.mockRestore();
  });
});

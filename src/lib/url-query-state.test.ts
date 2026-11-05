import { mergeUrlQuery } from './url-query-state';

describe('mergeUrlQuery', () => {
  it('updates and removes selected parameters while preserving unrelated context', () => {
    const query = mergeUrlQuery('?from=leaderboard&tab=old&search=carry', {
      tab: 'live',
      search: null,
      page: '2',
    });

    expect(new URLSearchParams(query)).toEqual(
      new URLSearchParams('from=leaderboard&tab=live&page=2')
    );
  });
});

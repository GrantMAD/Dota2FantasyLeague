export type UrlQueryUpdates = Record<string, string | null | undefined>;

export function mergeUrlQuery(search: string, updates: UrlQueryUpdates): string {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === '') params.delete(key);
    else params.set(key, value);
  }
  return params.toString();
}

export function replaceUrlQueryParams(updates: UrlQueryUpdates): void {
  if (typeof window === 'undefined') return;
  const query = mergeUrlQuery(window.location.search, updates);
  const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', url);
}

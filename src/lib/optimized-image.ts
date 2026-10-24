const OPTIMIZABLE_REMOTE_HOSTS = new Set([
  'steamcdn-a.akamaihd.net',
  'steamusercontent-a.akamaihd.net',
  'cdn.steamusercontent.com',
  'cdn.cloudflare.steamstatic.com',
]);

export function canOptimizeImage(source: string): boolean {
  if (source.startsWith('/') && !source.startsWith('//')) return true;

  try {
    const url = new URL(source);
    if (url.protocol !== 'https:') return false;
    if (OPTIMIZABLE_REMOTE_HOSTS.has(url.hostname)) return true;
    return url.hostname.endsWith('.supabase.co')
      && url.pathname.startsWith('/storage/v1/object/public/profile-avatars/');
  } catch {
    return false;
  }
}

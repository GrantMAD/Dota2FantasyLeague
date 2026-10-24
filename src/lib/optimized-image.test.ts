import { canOptimizeImage } from './optimized-image';

describe('canOptimizeImage', () => {
  it('allows local image sources', () => {
    expect(canOptimizeImage('/Images/logo.png')).toBe(true);
  });

  it('allows configured Steam image hosts', () => {
    expect(canOptimizeImage('https://cdn.cloudflare.steamstatic.com/apps/dota2/images/team_logos/1.png')).toBe(true);
  });

  it('allows only the public profile avatar bucket on Supabase hosts', () => {
    expect(canOptimizeImage('https://project.supabase.co/storage/v1/object/public/profile-avatars/avatar.png')).toBe(true);
    expect(canOptimizeImage('https://project.supabase.co/storage/v1/object/public/other-bucket/image.png')).toBe(false);
  });

  it('keeps unsupported, non-HTTPS, and protocol-relative sources unoptimized', () => {
    expect(canOptimizeImage('https://images.example.com/avatar.png')).toBe(false);
    expect(canOptimizeImage('http://cdn.cloudflare.steamstatic.com/avatar.png')).toBe(false);
    expect(canOptimizeImage('//cdn.cloudflare.steamstatic.com/avatar.png')).toBe(false);
  });
});

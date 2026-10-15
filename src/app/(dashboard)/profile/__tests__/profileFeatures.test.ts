import { computeAchievements } from '../components/achievementsData';
import { BANNER_THEMES, getBannerTheme } from '../components/bannerThemes';

describe('Profile Page Features (Section 1.10)', () => {
  describe('Banner Themes', () => {
    it('has at least 5 curated Dota hero themed presets', () => {
      expect(BANNER_THEMES.length).toBeGreaterThanOrEqual(5);
      const themeIds = BANNER_THEMES.map((t) => t.id);
      expect(themeIds).toContain('radiant-dawn');
      expect(themeIds).toContain('dire-crimson');
      expect(themeIds).toContain('abyssal-depths');
      expect(themeIds).toContain('aegis-gold');
    });

    it('getBannerTheme returns the matched theme or fallback', () => {
      const radiant = getBannerTheme('radiant-dawn');
      expect(radiant.name).toBe('Radiant Dawn');

      const fallback = getBannerTheme('non-existent-theme-id');
      expect(fallback.id).toBe('radiant-dawn');
    });
  });

  describe('Achievements and Badges Computation', () => {
    it('computes unlocked First Squad and Century Club milestones correctly', () => {
      const achievements = computeAchievements({
        hasSquad: true,
        squadName: 'Team Liquidators',
        totalPoints: 125,
        globalRank: 450,
        hasBio: true,
        timezone: 'UTC',
        countryCode: 'SE',
      });

      const firstSquad = achievements.find((a) => a.id === 'first-squad');
      expect(firstSquad?.unlocked).toBe(true);
      expect(firstSquad?.progressPercent).toBe(100);

      const century = achievements.find((a) => a.id === 'century-club');
      expect(century?.unlocked).toBe(true);
      expect(century?.progressPercent).toBe(100);

      const top1000 = achievements.find((a) => a.id === 'top-1000');
      expect(top1000?.unlocked).toBe(true);

      const profileMaster = achievements.find((a) => a.id === 'profile-master');
      expect(profileMaster?.unlocked).toBe(true);
    });

    it('handles new managers with no squad or points', () => {
      const achievements = computeAchievements({
        hasSquad: false,
        totalPoints: 0,
        globalRank: null,
        hasBio: false,
      });

      const firstSquad = achievements.find((a) => a.id === 'first-squad');
      expect(firstSquad?.unlocked).toBe(false);
      expect(firstSquad?.progressPercent).toBe(0);

      const top1000 = achievements.find((a) => a.id === 'top-1000');
      expect(top1000?.unlocked).toBe(false);
    });
  });
});

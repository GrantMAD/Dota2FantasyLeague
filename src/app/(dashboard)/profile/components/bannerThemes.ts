export type BannerThemeId =
  | 'radiant-dawn'
  | 'dire-crimson'
  | 'abyssal-depths'
  | 'aegis-gold'
  | 'arcane-void'
  | 'phantom-veil';

export interface BannerTheme {
  id: BannerThemeId;
  name: string;
  heroInspiration: string;
  accentColor: string;
  /** Inline gradient style — works in both light and dark mode regardless of Tailwind JIT scanning. */
  gradientStyle: string;
  glowClass: string;
  description: string;
  dotaRole: 'Carry' | 'Mid' | 'Offlane' | 'Support' | 'Hard Support' | 'Universal';
}

export const BANNER_THEMES: BannerTheme[] = [
  {
    id: 'radiant-dawn',
    name: 'Radiant Dawn',
    heroInspiration: 'Dawnbreaker / Omniknight',
    accentColor: '#34d399',
    gradientStyle: 'linear-gradient(to right, #059669, #0f766e, #0e7490)',
    glowClass: 'shadow-emerald-500/10 border-emerald-500/40',
    description: 'Brimming with celestial sunlight and holy radiant vigor.',
    dotaRole: 'Offlane',
  },
  {
    id: 'dire-crimson',
    name: 'Dire Cataclysm',
    heroInspiration: 'Doom / Shadow Fiend',
    accentColor: '#f43f5e',
    gradientStyle: 'linear-gradient(to right, #be123c, #9f1239, #b45309)',
    glowClass: 'shadow-rose-500/10 border-rose-500/40',
    description: 'Forged in brimstone and souls devoured by the Dire abyss.',
    dotaRole: 'Mid',
  },
  {
    id: 'abyssal-depths',
    name: 'Abyssal Depths',
    heroInspiration: 'Slardar / Tidehunter',
    accentColor: '#06b6d4',
    gradientStyle: 'linear-gradient(to right, #0891b2, #0369a1, #1e3a8a)',
    glowClass: 'shadow-cyan-500/10 border-cyan-500/40',
    description: 'Sunken sea trench mysteries and crushing ravage surges.',
    dotaRole: 'Hard Support',
  },
  {
    id: 'aegis-gold',
    name: 'Aegis Champion',
    heroInspiration: 'The International Champions',
    accentColor: '#f59e0b',
    gradientStyle: 'linear-gradient(to right, #d97706, #a16207, #c2410c)',
    glowClass: 'shadow-amber-500/10 border-amber-500/40',
    description: 'Immortalized in the golden luster of the Aegis of Champions.',
    dotaRole: 'Carry',
  },
  {
    id: 'arcane-void',
    name: 'Arcane Void',
    heroInspiration: 'Invoker / Rubick',
    accentColor: '#a855f7',
    gradientStyle: 'linear-gradient(to right, #7c3aed, #6d28d9, #3730a3)',
    glowClass: 'shadow-purple-500/10 border-purple-500/40',
    description: 'Mastery over the arcane weave and timeless cosmic spells.',
    dotaRole: 'Universal',
  },
  {
    id: 'phantom-veil',
    name: 'Phantom Veil',
    heroInspiration: 'Phantom Assassin / Spectre',
    accentColor: '#10b981',
    gradientStyle: 'linear-gradient(to right, #0f766e, #065f46, #1e293b)',
    glowClass: 'shadow-teal-500/10 border-teal-500/40',
    description: 'Silent strikes emerging from the Sisters of the Veil mist.',
    dotaRole: 'Support',
  },
];

export const DEFAULT_BANNER_THEME_ID: BannerThemeId = 'radiant-dawn';

export function getBannerTheme(id?: string | null): BannerTheme {
  const match = BANNER_THEMES.find((theme) => theme.id === id);
  return match || BANNER_THEMES[0];
}

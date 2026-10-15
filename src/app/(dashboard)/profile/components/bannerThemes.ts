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
  gradientClass: string;
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
    gradientClass: 'from-emerald-600/30 via-teal-900/60 to-cyan-600/25',
    glowClass: 'shadow-emerald-500/10 border-emerald-500/30',
    description: 'Brimming with celestial sunlight and holy radiant vigor.',
    dotaRole: 'Offlane',
  },
  {
    id: 'dire-crimson',
    name: 'Dire Cataclysm',
    heroInspiration: 'Doom / Shadow Fiend',
    accentColor: '#f43f5e',
    gradientClass: 'from-rose-700/40 via-red-950/70 to-amber-700/25',
    glowClass: 'shadow-rose-500/10 border-rose-500/30',
    description: 'Forged in brimstone and souls devoured by the Dire abyss.',
    dotaRole: 'Mid',
  },
  {
    id: 'abyssal-depths',
    name: 'Abyssal Depths',
    heroInspiration: 'Slardar / Tidehunter',
    accentColor: '#06b6d4',
    gradientClass: 'from-cyan-600/35 via-slate-900 to-blue-900/40',
    glowClass: 'shadow-cyan-500/10 border-cyan-500/30',
    description: 'Sunken sea trench mysteries and crushing ravage surges.',
    dotaRole: 'Hard Support',
  },
  {
    id: 'aegis-gold',
    name: 'Aegis Champion',
    heroInspiration: 'The International Champions',
    accentColor: '#f59e0b',
    gradientClass: 'from-amber-500/35 via-yellow-950/60 to-orange-700/30',
    glowClass: 'shadow-amber-500/10 border-amber-500/30',
    description: 'Immortalized in the golden luster of the Aegis of Champions.',
    dotaRole: 'Carry',
  },
  {
    id: 'arcane-void',
    name: 'Arcane Void',
    heroInspiration: 'Invoker / Rubick',
    accentColor: '#a855f7',
    gradientClass: 'from-purple-700/35 via-violet-950/70 to-indigo-800/30',
    glowClass: 'shadow-purple-500/10 border-purple-500/30',
    description: 'Mastery over the arcane weave and timeless cosmic spells.',
    dotaRole: 'Universal',
  },
  {
    id: 'phantom-veil',
    name: 'Phantom Veil',
    heroInspiration: 'Phantom Assassin / Spectre',
    accentColor: '#10b981',
    gradientClass: 'from-teal-800/35 via-slate-950 to-emerald-950/60',
    glowClass: 'shadow-teal-500/10 border-teal-500/30',
    description: 'Silent strikes emerging from the Sisters of the Veil mist.',
    dotaRole: 'Support',
  },
];

export const DEFAULT_BANNER_THEME_ID: BannerThemeId = 'radiant-dawn';

export function getBannerTheme(id?: string | null): BannerTheme {
  const match = BANNER_THEMES.find((theme) => theme.id === id);
  return match || BANNER_THEMES[0];
}

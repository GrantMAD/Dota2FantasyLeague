export type PremiumFeature = 'advanced-analytics' | 'ai-recommendations' | 'extended-history';

export function isPremiumUser(profile: { is_premium?: boolean; subscription_tier?: string } | null | undefined): boolean {
  return profile?.is_premium === true || profile?.subscription_tier === 'premium' || profile?.subscription_tier === 'pro';
}

export function canUsePremiumFeature(profile: { is_premium?: boolean; subscription_tier?: string } | null | undefined, feature: PremiumFeature): boolean {
  return isPremiumUser(profile) && ['advanced-analytics', 'ai-recommendations', 'extended-history'].includes(feature);
}

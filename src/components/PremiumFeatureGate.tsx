'use client';

import { isPremiumFeatureUnlocked } from '@/lib/analytics';

const userTier = 'pro';
const requiredTier = 'pro';

export function PremiumFeatureGate() {
  const unlocked = isPremiumFeatureUnlocked(userTier, requiredTier);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Premium Access</h3>
        <span
          className={`text-xs uppercase tracking-wide ${
            unlocked ? 'text-amber-500' : 'text-slate-400'
          }`}
        >
          {unlocked ? 'Unlocked' : 'Locked'}
        </span>
      </div>

      <p className="text-slate-400 text-sm mb-4">
        Advanced league insights, deeper analytics, and priority tools are available for paid users.
      </p>

      <div className="rounded border border-slate-700 bg-slate-900/60 p-4">
        <p className="text-sm text-slate-300">Current tier: {userTier}</p>
        <p className="text-sm text-slate-300">Required tier: {requiredTier}</p>
        <p className="text-sm font-medium mt-3 text-amber-500">
          {unlocked
            ? 'This feature is available to the current account.'
            : 'Upgrade to unlock this premium feature.'}
        </p>
      </div>
    </div>
  );
}

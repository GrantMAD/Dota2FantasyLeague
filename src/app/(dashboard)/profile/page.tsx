'use client';

import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  BANNER_THEMES,
  DEFAULT_BANNER_THEME_ID,
  getBannerTheme,
  type BannerThemeId,
} from './components/bannerThemes';
import { BannerThemeSelector } from './components/BannerThemeSelector';
import { AccountHealthProgress } from './components/AccountHealthProgress';
import { ProfileAchievements } from './components/ProfileAchievements';
import { computeAchievements } from './components/achievementsData';

type Profile = {
  username: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country_code: string | null;
  timezone: string | null;
  banner_theme?: string | null;
  role?: string | null;
  member_since?: string | null;
  created_at: string;
  fantasy_team?: {
    name: string;
    total_points: number;
    global_rank: number | null;
  } | null;
};

const BANNER_STORAGE_KEY = 'dota_fantasy_profile_banner_theme';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState<BannerThemeId>(() => {
    if (typeof window === 'undefined') return DEFAULT_BANNER_THEME_ID;
    try {
      const stored = localStorage.getItem(BANNER_STORAGE_KEY) as BannerThemeId | null;
      if (stored && BANNER_THEMES.some((t) => t.id === stored)) {
        return stored;
      }
    } catch {
      // Ignore localStorage availability issues
    }
    return DEFAULT_BANNER_THEME_ID;
  });

  const handleSelectTheme = async (themeId: BannerThemeId) => {
    setSelectedThemeId(themeId);
    try {
      localStorage.setItem(BANNER_STORAGE_KEY, themeId);
    } catch {
      // Ignore localStorage errors
    }
    try {
      const res = await fetchWithAuth('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banner_theme: themeId }),
      });
      if (!res.ok) {
        console.error('Failed to persist banner theme to database', await res.text());
      }
    } catch (err) {
      console.error('Error persisting banner theme:', err);
    }
  };

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetchWithAuth('/api/user/profile');
        if (!res.ok) throw new Error('Failed to load profile');
        const data = (await res.json()) as { profile: Profile | null };
        setProfile(data.profile);
        const theme = data.profile?.banner_theme;
        if (theme && BANNER_THEMES.some((t) => t.id === theme)) {
          setSelectedThemeId(theme as BannerThemeId);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    }

    void fetchProfile();
  }, []);

  const bannerTheme = useMemo(() => getBannerTheme(selectedThemeId), [selectedThemeId]);

  const achievements = useMemo(() => {
    if (!profile) return [];
    return computeAchievements({
      hasSquad: Boolean(profile.fantasy_team),
      squadName: profile.fantasy_team?.name,
      totalPoints: Number(profile.fantasy_team?.total_points ?? 0),
      globalRank: profile.fantasy_team?.global_rank ?? null,
      hasBio: Boolean(profile.bio?.trim()),
      memberSince: profile.member_since || profile.created_at,
      timezone: profile.timezone,
      countryCode: profile.country_code,
    });
  }, [profile]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="h-48 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/80" />
      </div>
    );
  }

  if (error || !profile) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-red-400">{error || 'Profile not available'}</div>;
  }

  const initials = (profile.display_name || profile.username || 'U').slice(0, 1).toUpperCase();
  const memberSince = new Date(profile.member_since || profile.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' });
  const hasBio = Boolean(profile.bio?.trim());
  const hasFantasyTeam = Boolean(profile.fantasy_team);

  const accountHealthItems: Array<[string, boolean]> = [
    ['Profile identity', Boolean(profile.display_name || profile.username)],
    ['Fantasy squad', hasFantasyTeam],
    ['Bio added', hasBio],
    ['Preferences set', Boolean(profile.timezone)],
  ];
  const completedHealthCount = accountHealthItems.filter(([, complete]) => complete).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Manager identity</p>
          <h1 className="text-3xl font-black text-white">Profile</h1>
          <p className="mt-2 text-sm text-slate-400">Your competitive identity, hero styling, and fantasy career snapshots.</p>
        </div>
        <div className="flex items-center gap-3">
          <BannerThemeSelector currentTheme={bannerTheme} onSelectTheme={handleSelectTheme} />
          <Link
            href="/settings?section=profile"
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
          >
            Edit profile
          </Link>
        </div>
      </div>

      {/* Hero Banner Card */}
      <section className={`overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/80 shadow-2xl transition-all duration-300 ${bannerTheme.glowClass}`}>
        {/* Dynamic Dota Hero Theme Banner */}
        <div className={`relative h-36 md:h-44 bg-linear-to-r ${bannerTheme.gradientClass} transition-all duration-500`}>
          <div className="absolute inset-0 bg-radial from-transparent via-slate-950/20 to-slate-950/80 pointer-events-none" />
          <div className="absolute right-4 top-3 z-10 flex items-center gap-2">
            <span className="rounded-full border border-white/20 bg-slate-950/60 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-md">
              Hero Theme: {bannerTheme.name} ({bannerTheme.dotaRole})
            </span>
          </div>
        </div>

        <div className="relative z-10 px-5 pb-6 md:px-8">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end md:gap-6">
            <div className="relative z-20 flex h-24 w-24 md:h-28 md:w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-slate-950 bg-slate-800 shadow-2xl ring-2 ring-slate-800/80">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.username} width={112} height={112} unoptimized className="h-full w-full object-cover" />
              ) : (
                <span className="text-4xl font-black text-cyan-300">{initials}</span>
              )}
            </div>
            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold text-white">{profile.display_name || profile.username}</h2>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Active manager</span>
              </div>
              <p className="mt-1 text-sm text-slate-400">@{profile.username} · Member since {memberSince}</p>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Fantasy squad</p>
              <p className="mt-2 truncate text-lg font-bold text-white">{profile.fantasy_team?.name || 'No squad yet'}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total points</p>
              <p className="mt-2 text-2xl font-black text-amber-300">{profile.fantasy_team?.total_points ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Global rank</p>
              <p className="mt-2 text-2xl font-black text-emerald-300">{profile.fantasy_team?.global_rank ?? '—'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Manager Bio & Account Health Progress */}
      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 flex flex-col justify-between">
          <div>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">About this manager</h2>
                <p className="mt-1 text-sm text-slate-400">The identity shown across your fantasy community.</p>
              </div>
              <Link href="/settings?section=profile" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">Edit</Link>
            </div>
            <p className="min-h-16 text-sm leading-7 text-slate-300">{hasBio ? profile.bio : 'Add a short bio to tell your league rivals who they are competing against.'}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5">{profile.country_code || 'Country not set'}</span>
            <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5">{profile.timezone || 'UTC'}</span>
            <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5">{profile.role === 'admin' ? 'Admin access' : 'Manager account'}</span>
          </div>
        </section>

        {/* Account Health with Circular Progress Ring */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Account health</h2>
              <p className="mt-1 text-xs text-slate-400">Profile readiness for competition.</p>
            </div>
            {/* Circular Progress Ring */}
            <AccountHealthProgress completed={completedHealthCount} total={accountHealthItems.length} />
          </div>

          <div className="mt-5 space-y-2.5">
            {accountHealthItems.map(([label, complete]) => (
              <div key={String(label)} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5">
                <span className="text-sm text-slate-300">{String(label)}</span>
                <span className={`text-xs font-semibold ${complete ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {complete ? 'Ready' : 'Review'}
                </span>
              </div>
            ))}
          </div>
          <Link href="/settings?section=account" className="mt-5 inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200">Manage account details →</Link>
        </section>
      </div>

      {/* Achievement & Badge Section */}
      <ProfileAchievements achievements={achievements} />
    </div>
  );
}

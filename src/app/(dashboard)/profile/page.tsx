'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/user/profile');
        if (!res.ok) throw new Error('Failed to load profile');
        const data = await res.json();
        setProfile(data.profile);
      } catch (err: any) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-12 text-slate-400">Loading profile...</div>;
  }

  if (error || !profile) {
    return <div className="max-w-4xl mx-auto px-4 py-12 text-red-400">{error || 'Profile not available'}</div>;
  }

  const initials = (profile.display_name || profile.username || 'U').substring(0, 1).toUpperCase();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="profile-card bg-linear-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-xl mb-8">
        <div className="h-32 bg-linear-to-r from-indigo-900/40 to-purple-900/40 border-b border-slate-700/50"></div>

        <div className="px-8 pb-8 relative">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6 -mt-16 mb-6">
            <div className="w-32 h-32 rounded-full bg-slate-800 border-4 border-slate-900 shadow-lg overflow-hidden flex items-center justify-center shrink-0 z-10">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl text-slate-500 font-bold">{initials}</span>
              )}
            </div>

            <div className="flex-1 pb-2">
              <h1 className="text-3xl font-bold text-white mb-1">{profile.display_name || profile.username}</h1>
              <div className="flex items-center gap-3 text-sm text-slate-400 flex-wrap">
                <span className="font-medium text-slate-300">@{profile.username}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  {profile.country || 'Unknown'}
                </span>
                <span>•</span>
                <span>Member since {new Date(profile.member_since || profile.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' })}</span>
              </div>
            </div>

            <div className="pb-2 sm:text-right">
              <Link href="/settings" className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                Edit Profile
              </Link>
            </div>
          </div>

          <div className="border-t border-slate-700/50 pt-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Fantasy Career (Current Season)</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <div className="text-xs text-slate-400 mb-1">Team Name</div>
                <div className="text-lg font-bold text-white truncate">{profile.fantasy_team?.name || 'No team yet'}</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <div className="text-xs text-slate-400 mb-1">Total Points</div>
                <div className="text-xl font-bold text-amber-500">{profile.fantasy_team?.total_points ?? 0}</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <div className="text-xs text-slate-400 mb-1">Global Rank</div>
                <div className="text-xl font-bold text-emerald-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
                  {profile.fantasy_team?.global_rank ?? '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

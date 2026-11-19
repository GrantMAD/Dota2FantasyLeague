'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  X,
  User,
  Shield,
  Swords,
  AlertCircle,
  Mail,
  Clock,
  CheckCircle,
  Activity,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useToast } from '@/components/Toast';

interface AdminUserDetailModalProps {
  userId: string | null;
  onClose: () => void;
  onUserUpdated?: () => void;
}

interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country_code: string | null;
  timezone: string | null;
  theme_preference: 'light' | 'dark';
  banner_theme: string | null;
  email_notifications: boolean;
  push_notifications: boolean;
  live_squad_match_notifications: boolean;
  match_data_processed_notifications: boolean;
  fantasy_points_calculated_notifications: boolean;
  role: string;
  is_premium: boolean;
  subscription_tier: string | null;
  created_at: string;
  updated_at: string;
  email: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
}

interface SquadMember {
  id: number;
  player_id: number;
  cost: number;
  acquired_date: string | null;
  professional_players: {
    id: number;
    name: string;
    in_game_name: string;
    primary_role: string;
    profile_image_url: string | null;
    professional_teams?: {
      id: number;
      name: string;
      logo_url: string | null;
    } | null;
  } | null;
}

interface FantasySquad {
  id: number;
  name: string;
  created_at: string;
  fantasy_squad_members: SquadMember[];
}

interface FantasySeason {
  id: number;
  season_id: number;
  budget: number | null;
  total_points: number | null;
  global_rank: number | null;
  free_transfers: number | null;
  triple_captain_gameweek_id: number | null;
  bench_boost_gameweek_id: number | null;
  wildcard_used_gameweek_id: number | null;
  seasons: { id: number; name: string; status: string } | null;
  fantasy_squads: FantasySquad[];
}

interface LeagueMembership {
  id: number;
  points: number | null;
  rank: number | null;
  joined_at: string | null;
  leagues: {
    id: number;
    name: string;
    league_type: string;
    privacy_level: string;
    current_participants: number;
    max_participants: number;
  } | null;
}

interface CreatedLeague {
  id: number;
  name: string;
  league_type: string;
  privacy_level: string;
  current_participants: number;
  max_participants: number;
  created_at: string;
}

interface IssueReport {
  id: number;
  title: string;
  category: string;
  severity: string;
  status: string;
  created_at: string;
}

interface AuditLog {
  id: number;
  table_name: string;
  action: string;
  created_at: string;
  changed_by: string | null;
}

interface UserDetailResponse {
  user: UserProfile;
  fantasy_seasons: FantasySeason[];
  league_memberships: LeagueMembership[];
  created_leagues: CreatedLeague[];
  issue_reports: IssueReport[];
  audit_logs: AuditLog[];
}

type TabType = 'overview' | 'squad' | 'leagues' | 'activity';

export default function AdminUserDetailModal({
  userId,
  onClose,
  onUserUpdated,
}: AdminUserDetailModalProps) {
  const toast = useToast();
  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const loading = Boolean(userId && loadedUserId !== userId);

  // Edit State
  const [editRole, setEditRole] = useState<'user' | 'admin'>('user');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editTier, setEditTier] = useState('free');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let ignore = false;

    async function loadUserDetails() {
      try {
        const res = await fetchWithAuth(`/api/admin/users/${userId}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to load user details');
        }
        const json = (await res.json()) as UserDetailResponse;
        if (!ignore) {
          setData(json);
          setEditRole(json.user.role === 'admin' ? 'admin' : 'user');
          setEditDisplayName(json.user.display_name || '');
          setEditBio(json.user.bio || '');
          setEditTier(json.user.subscription_tier || 'free');
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      } finally {
        if (!ignore) {
          setLoadedUserId(userId);
        }
      }
    }

    void loadUserDetails();
    return () => {
      ignore = true;
    };
  }, [userId]);

  if (!userId) return null;

  const handleSaveChanges = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: editRole,
          display_name: editDisplayName.trim() || null,
          bio: editBio.trim() || null,
          subscription_tier: editTier,
          is_premium: editTier !== 'free',
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Failed to update user');
      }

      toast.success('User updated', `Saved changes for ${data.user.username}`);
      setData((prev) =>
        prev
          ? {
              ...prev,
              user: {
                ...prev.user,
                role: editRole,
                display_name: editDisplayName.trim() || null,
                bio: editBio.trim() || null,
                subscription_tier: editTier,
                is_premium: editTier !== 'free',
              },
            }
          : null
      );
      if (onUserUpdated) onUserUpdated();
    } catch (err) {
      toast.error('Update failed', err instanceof Error ? err.message : 'Save error');
    } finally {
      setSaving(false);
    }
  };

  const currentSeason = data?.fantasy_seasons?.[0];
  const currentSquad = currentSeason?.fantasy_squads?.[0];
  const members = currentSquad?.fantasy_squad_members || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {data?.user.display_name || data?.user.username || 'User Details'}
                {data?.user.role === 'admin' && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                    Admin
                  </span>
                )}
                {data?.user.is_premium && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    Premium
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                ID: {userId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <User className="w-4 h-4" /> Overview & Account
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('squad')}
            className={`py-3 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'squad'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Swords className="w-4 h-4" /> Fantasy Squad {members.length > 0 && `(${members.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('leagues')}
            className={`py-3 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'leagues'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" /> Leagues ({data?.league_memberships.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`py-3 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'activity'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" /> Reports & Audit ({data?.issue_reports.length || 0})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 space-y-6">
          {loading && (
            <div className="py-16 text-center text-slate-400 animate-pulse space-y-3">
              <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto" />
              <p className="text-sm">Loading user account and telemetry...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && data && (
            <>
              {/* Tab 1: Overview & Account */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Identity Banner */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
                      {data.user.avatar_url ? (
                        <Image
                          src={data.user.avatar_url}
                          alt="Avatar"
                          width={48}
                          height={48}
                          unoptimized
                          className="w-12 h-12 rounded-full object-cover border border-slate-300 dark:border-slate-700"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-lg">
                          {data.user.username.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Username</p>
                        <p className="font-bold text-slate-900 dark:text-white">@{data.user.username}</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                      <Mail className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Email</p>
                        <p className="font-semibold text-slate-900 dark:text-white truncate text-sm">
                          {data.user.email || 'Not available'}
                        </p>
                        {data.user.email_confirmed_at && (
                          <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Confirmed
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                      <Clock className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Registered</p>
                        <p className="font-semibold text-slate-900 dark:text-white text-sm">
                          {new Date(data.user.created_at).toLocaleDateString()}
                        </p>
                        {data.user.last_sign_in_at && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            Last seen: {new Date(data.user.last_sign_in_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Administrative Controls */}
                  <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-500" />
                      Admin Actions & Role Management
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          System Role
                        </label>
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as 'user' | 'admin')}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        >
                          <option value="user">User (Standard Manager)</option>
                          <option value="admin">Admin (System Administrator)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Subscription Tier
                        </label>
                        <select
                          value={editTier}
                          onChange={(e) => setEditTier(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        >
                          <option value="free">Free</option>
                          <option value="premium">Premium</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          placeholder="Display Name"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Manager Bio
                        </label>
                        <input
                          type="text"
                          value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          placeholder="Short bio"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => void handleSaveChanges()}
                        disabled={saving}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save Profile Changes'}
                      </button>
                    </div>
                  </div>

                  {/* Account Preferences Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Preferences
                      </h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700/50">
                          <span className="text-slate-500 dark:text-slate-400">Theme:</span>
                          <span className="font-semibold uppercase text-slate-900 dark:text-white">{data.user.theme_preference}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700/50">
                          <span className="text-slate-500 dark:text-slate-400">Banner Theme:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{data.user.banner_theme || 'Default'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700/50">
                          <span className="text-slate-500 dark:text-slate-400">Country Code:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{data.user.country_code || '—'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500 dark:text-slate-400">Timezone:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{data.user.timezone || 'UTC'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Notification Channels
                      </h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700/50">
                          <span className="text-slate-500 dark:text-slate-400">Email Notifications:</span>
                          <span className={`font-semibold ${data.user.email_notifications ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                            {data.user.email_notifications ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700/50">
                          <span className="text-slate-500 dark:text-slate-400">Push Notifications:</span>
                          <span className={`font-semibold ${data.user.push_notifications ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                            {data.user.push_notifications ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700/50">
                          <span className="text-slate-500 dark:text-slate-400">Live Squad Match Alerts:</span>
                          <span className={`font-semibold ${data.user.live_squad_match_notifications ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                            {data.user.live_squad_match_notifications ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500 dark:text-slate-400">Points Calculated Alerts:</span>
                          <span className={`font-semibold ${data.user.fantasy_points_calculated_notifications ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                            {data.user.fantasy_points_calculated_notifications ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Fantasy Squad */}
              {activeTab === 'squad' && (
                <div className="space-y-6">
                  {currentSeason ? (
                    <>
                      {/* Squad KPI Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Squad Name</p>
                          <p className="font-bold text-slate-900 dark:text-white truncate">{currentSquad?.name || 'My Squad'}</p>
                        </div>
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Points</p>
                          <p className="font-bold text-amber-500 text-lg">{currentSeason.total_points ?? 0} pts</p>
                        </div>
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Global Rank</p>
                          <p className="font-bold text-slate-900 dark:text-white text-lg">#{currentSeason.global_rank || '—'}</p>
                        </div>
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Remaining Budget</p>
                          <p className="font-bold text-slate-900 dark:text-white text-lg">${currentSeason.budget ?? 0}M</p>
                        </div>
                      </div>

                      {/* Active Roster */}
                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                            Active Roster ({members.length} / 8)
                          </h4>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Free Transfers: <strong className="text-slate-900 dark:text-white">{currentSeason.free_transfers ?? 1}</strong>
                          </span>
                        </div>
                        <div className="divide-y divide-slate-200 dark:divide-slate-800">
                          {members.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">
                              No players drafted to this squad yet.
                            </div>
                          ) : (
                            members.map((m) => (
                              <div key={m.id} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <div className="flex items-center gap-3">
                                  {m.professional_players?.profile_image_url ? (
                                    <Image
                                      src={m.professional_players.profile_image_url}
                                      alt="Player"
                                      width={36}
                                      height={36}
                                      unoptimized
                                      className="w-9 h-9 rounded-full object-cover border border-slate-300 dark:border-slate-700"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-600 dark:text-slate-300">
                                      {m.professional_players?.name?.slice(0, 2) || 'P'}
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-bold text-sm text-slate-900 dark:text-white">
                                      {m.professional_players?.in_game_name || m.professional_players?.name || 'Unknown Player'}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                      <span className="uppercase font-semibold text-amber-600 dark:text-amber-400">
                                        {m.professional_players?.primary_role?.replace('_', ' ') || 'Player'}
                                      </span>
                                      {m.professional_players?.professional_teams?.name && (
                                        <span>• {m.professional_players.professional_teams.name}</span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                                    ${Number(m.cost).toFixed(1)}M
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-12 text-center text-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/20">
                      <Swords className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-50" />
                      <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No Fantasy Squad</p>
                      <p className="text-xs text-slate-400 mt-1">This user has not enrolled in any fantasy seasons or drafted a squad yet.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Leagues */}
              {activeTab === 'leagues' && (
                <div className="space-y-6">
                  {/* Joined Leagues */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Joined Leagues ({data.league_memberships.length})
                      </h4>
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {data.league_memberships.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">
                          User has not joined any leagues.
                        </div>
                      ) : (
                        data.league_memberships.map((membership) => (
                          <div key={membership.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <div>
                              <p className="font-bold text-sm text-slate-900 dark:text-white">
                                {membership.leagues?.name || `League #${membership.id}`}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Type: <span className="uppercase font-semibold">{membership.leagues?.league_type}</span> • {membership.leagues?.privacy_level}
                              </p>
                            </div>
                            <div className="text-right flex items-center gap-4">
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Rank</p>
                                <p className="font-bold text-slate-900 dark:text-white">#{membership.rank ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Points</p>
                                <p className="font-bold text-amber-500">{membership.points ?? 0}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Created Leagues */}
                  {data.created_leagues.length > 0 && (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Leagues Created as Commissioner ({data.created_leagues.length})
                        </h4>
                      </div>
                      <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {data.created_leagues.map((league) => (
                          <div key={league.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <div>
                              <p className="font-bold text-sm text-slate-900 dark:text-white">{league.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {league.current_participants} / {league.max_participants} members • Created {new Date(league.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              Commissioner
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Reports & Audit */}
              {activeTab === 'activity' && (
                <div className="space-y-6">
                  {/* Issue Reports */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Submitted Bug & Issue Reports ({data.issue_reports.length})
                      </h4>
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {data.issue_reports.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-sm">
                          No reports submitted by this user.
                        </div>
                      ) : (
                        data.issue_reports.map((r) => (
                          <div key={r.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <div>
                              <p className="font-semibold text-sm text-slate-900 dark:text-white">{r.title}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {r.category} • Severity: {r.severity} • {new Date(r.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                              {r.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Audit Trail */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Recent Audit Trail ({data.audit_logs.length})
                      </h4>
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {data.audit_logs.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-sm">
                          No audit entries recorded for this user.
                        </div>
                      ) : (
                        data.audit_logs.map((log) => (
                          <div key={log.id} className="p-3 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-white uppercase mr-2">
                                {log.action}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400">
                                on {log.table_name}
                              </span>
                            </div>
                            <span className="text-slate-400">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

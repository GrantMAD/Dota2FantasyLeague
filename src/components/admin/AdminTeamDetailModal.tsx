'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Trophy,
  Users,
  Coins,
  ArrowRightLeft,
  Calendar,
  Award,
  Zap,
  Shield,
  Star,
  ExternalLink,
  ChevronRight,
  Activity,
  AlertCircle
} from 'lucide-react';
import AdminPlayerDetailModal from '@/components/admin/AdminPlayerDetailModal';

interface AdminTeamDetailModalProps {
  teamId: string | null;
  onClose: () => void;
}

interface TeamDetailData {
  team: {
    id: number;
    name: string;
    budget: number;
    total_points: number;
    global_rank: number | null;
    free_transfers: number;
    created_at: string;
    chips: {
      triple_captain_gameweek_id: number | null;
      bench_boost_gameweek_id: number | null;
      wildcard_used_gameweek_id: number | null;
    };
  };
  manager: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    email?: string | null;
  };
  season: {
    id: number;
    name: string;
    status: string;
  } | null;
  squad: {
    id: number | null;
    name: string;
    members: Array<{
      id: number;
      player_id: number;
      cost: number;
      acquired_date: string;
      player: {
        id: number;
        name: string;
        in_game_name: string;
        primary_role: string;
        profile_image_url: string | null;
        country: string | null;
        availability_status?: string | null;
        professional_teams?: {
          id: number;
          name: string;
          slug: string;
          logo_url: string | null;
        };
      } | null;
    }>;
  };
  lineups: Array<{
    id: number;
    gameweek_id: number;
    gameweek_number: number | null;
    gameweek_status: string | null;
    total_points: number;
    locked: boolean;
    locked_at: string | null;
    captain_player_id: number;
    vice_captain_player_id: number | null;
    slots: Array<{
      slot: string;
      player_id: number;
      is_starter: boolean;
      is_captain: boolean;
      is_vice_captain: boolean;
      player: {
        id: number;
        name: string;
        in_game_name: string;
        primary_role: string;
        profile_image_url: string | null;
        professional_teams?: {
          name: string;
          slug: string;
        };
      } | null;
    }>;
  }>;
  transfers: Array<{
    id: number;
    gameweek_id: number;
    gameweek_number: number | null;
    transfer_fee: number;
    created_at: string;
    player_out: {
      id: number;
      name: string;
      in_game_name: string;
      primary_role: string;
      profile_image_url?: string | null;
      professional_teams?: { name: string };
    } | null;
    player_in: {
      id: number;
      name: string;
      in_game_name: string;
      primary_role: string;
      profile_image_url?: string | null;
      professional_teams?: { name: string };
    } | null;
  }>;
  leagues: Array<{
    id: number;
    points: number;
    rank: number | null;
    joined_at: string;
    league: {
      id: number;
      name: string;
      league_type: string;
      privacy_level: string;
      current_participants: number;
      max_participants: number | null;
    } | null;
  }>;
}

const ROLE_LABELS: Record<string, string> = {
  carry: 'Carry (Pos 1)',
  mid: 'Mid (Pos 2)',
  offlane: 'Offlane (Pos 3)',
  support: 'Support (Pos 4)',
  hard_support: 'Hard Support (Pos 5)',
  bench_1: 'Bench 1',
  bench_2: 'Bench 2',
  bench_3: 'Bench 3',
};

const getRoleBadgeLabel = (role?: string | null): string => {
  if (!role) return 'Position';
  const lower = role.toLowerCase().replace(/[\s_-]/g, '');
  if (lower.includes('hardsupport') || lower === 'pos5') return 'Hard Support';
  if (lower.includes('softsupport') || (lower.includes('support') && !lower.includes('hard')) || lower === 'pos4') return 'Support';
  if (lower.includes('offlane') || lower === 'pos3') return 'Offlane';
  if (lower.includes('mid') || lower === 'pos2') return 'Mid';
  if (lower.includes('carry') || lower === 'pos1') return 'Carry';
  return role;
};

export default function AdminTeamDetailModal({ teamId, onClose }: AdminTeamDetailModalProps) {
  const [data, setData] = useState<TeamDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'roster' | 'lineups' | 'transfers' | 'leagues'>('roster');
  const [selectedGwId, setSelectedGwId] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch Team Details
  useEffect(() => {
    if (!teamId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    async function loadData() {
      try {
        const res = await fetch(`/api/admin/fantasy-teams/${teamId}`);
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `HTTP error ${res.status}`);
        }
        const json = await res.json();
        if (isMounted) {
          setData(json);
          if (json.lineups && json.lineups.length > 0) {
            setSelectedGwId(json.lineups[0].gameweek_id);
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load team details');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [teamId]);

  if (!teamId) return null;

  const currentGwLineup = data?.lineups.find((l) => l.gameweek_id === selectedGwId) || data?.lineups[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold border border-amber-500/30">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {data?.team.name || 'Fantasy Squad'}
                </h2>
                {data?.team.global_rank && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                    Rank #{data.team.global_rank}
                  </span>
                )}
                {data?.season && (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {data.season.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-slate-500 dark:text-slate-400">
                <Users className="w-4 h-4" />
                <span>Manager: <strong className="text-slate-700 dark:text-slate-200">{data?.manager.display_name || data?.manager.username || 'Loading...'}</strong></span>
                {data?.manager.email && <span className="text-xs">({data.manager.email})</span>}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex-1 p-12 flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-slate-400 font-medium">Loading fantasy team details...</p>
          </div>
        ) : error ? (
          <div className="flex-1 p-12 flex flex-col items-center justify-center space-y-3 text-center">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Unable to load team</h3>
            <p className="text-sm text-slate-400 max-w-md">{error}</p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        ) : data ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* KPI Stat Bar & Chip Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-slate-100/60 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Points</span>
                <p className="text-xl font-bold font-mono text-amber-500 mt-0.5">
                  {data.team.total_points.toLocaleString()}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Budget Left</span>
                <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                  ${(data.team.budget).toFixed(1)}M
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Free Transfers</span>
                <p className="text-xl font-bold font-mono text-blue-500 mt-0.5">
                  {data.team.free_transfers}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Chips</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded font-medium border ${
                      data.team.chips.triple_captain_gameweek_id
                        ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
                        : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-700/40 dark:text-slate-500 dark:border-slate-700'
                    }`}
                    title={data.team.chips.triple_captain_gameweek_id ? `Used in GW${data.team.chips.triple_captain_gameweek_id}` : 'Available'}
                  >
                    TC {data.team.chips.triple_captain_gameweek_id ? `(GW${data.team.chips.triple_captain_gameweek_id})` : '—'}
                  </span>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded font-medium border ${
                      data.team.chips.bench_boost_gameweek_id
                        ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30'
                        : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-700/40 dark:text-slate-500 dark:border-slate-700'
                    }`}
                    title={data.team.chips.bench_boost_gameweek_id ? `Used in GW${data.team.chips.bench_boost_gameweek_id}` : 'Available'}
                  >
                    BB {data.team.chips.bench_boost_gameweek_id ? `(GW${data.team.chips.bench_boost_gameweek_id})` : '—'}
                  </span>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded font-medium border ${
                      data.team.chips.wildcard_used_gameweek_id
                        ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30'
                        : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-700/40 dark:text-slate-500 dark:border-slate-700'
                    }`}
                    title={data.team.chips.wildcard_used_gameweek_id ? `Used in GW${data.team.chips.wildcard_used_gameweek_id}` : 'Available'}
                  >
                    WC {data.team.chips.wildcard_used_gameweek_id ? `(GW${data.team.chips.wildcard_used_gameweek_id})` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-900/40">
              <button
                onClick={() => setActiveTab('roster')}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'roster'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                Active Squad ({data.squad.members.length}/8)
              </button>
              <button
                onClick={() => setActiveTab('lineups')}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'lineups'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Gameweek Lineups ({data.lineups.length})
              </button>
              <button
                onClick={() => setActiveTab('transfers')}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'transfers'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <ArrowRightLeft className="w-4 h-4" />
                Transfers ({data.transfers.length})
              </button>
              <button
                onClick={() => setActiveTab('leagues')}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'leagues'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Award className="w-4 h-4" />
                Leagues ({data.leagues.length})
              </button>
            </div>

            {/* Tab Panels */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
              {/* TAB 1: ACTIVE SQUAD ROSTER */}
              {activeTab === 'roster' && (
                <div className="space-y-8">
                  {data.squad.members.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                      No active squad members registered for this team yet.
                    </div>
                  ) : (
                    <>
                      {/* Section 1: Starting 5 */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                              Starting 5 ({Math.min(data.squad.members.length, 5)}/5)
                            </h3>
                          </div>
                          <span className="text-xs text-slate-400">
                            Core & Support Lineup
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                          {data.squad.members.slice(0, 5).map((member, index) => {
                            const player = member.player;
                            const playerId = player?.id || member.player_id;
                            const roleDisplay = getRoleBadgeLabel(player?.primary_role);
                            return (
                              <div
                                key={member.id}
                                onClick={() => playerId && setSelectedPlayerId(playerId)}
                                className="group relative p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-800/80 hover:border-amber-500/70 shadow-sm hover:shadow-lg hover:shadow-amber-500/5 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden text-left flex flex-col justify-between"
                              >
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500/30 via-amber-500 to-amber-500/30 group-hover:h-1.5 transition-all" />

                                <div>
                                  <div className="flex items-center justify-between gap-1 mb-2.5">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300/60 dark:border-amber-500/30 uppercase tracking-wider">
                                      Pos {index + 1}
                                    </span>
                                    <div className="flex items-center gap-1 font-mono text-xs font-bold text-slate-800 dark:text-amber-400 bg-slate-100 dark:bg-slate-900/70 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/60">
                                      <Coins className="w-3 h-3 text-amber-500 shrink-0" />
                                      <span>${member.cost.toFixed(1)}M</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2.5 mt-2">
                                    <div className="relative shrink-0">
                                      {player?.profile_image_url ? (
                                        <img
                                          src={player.profile_image_url}
                                          alt={player.in_game_name || player.name}
                                          className="w-11 h-11 rounded-xl object-cover bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 group-hover:border-amber-500 transition-colors shadow-sm"
                                        />
                                      ) : (
                                        <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-black text-base text-slate-500 dark:text-slate-300 border border-slate-300 dark:border-slate-600 group-hover:border-amber-500 transition-colors">
                                          {(player?.in_game_name || player?.name || '?').charAt(0)}
                                        </div>
                                      )}
                                      {player?.availability_status === 'available' && (
                                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full" />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between">
                                        <p className="text-sm font-black truncate text-slate-900 dark:text-white group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
                                          {player?.in_game_name || player?.name || 'Unknown'}
                                        </p>
                                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100 shrink-0" />
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                          {roleDisplay}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1" title={player?.professional_teams?.name || 'Free Agent'}>
                                        {player?.professional_teams?.name || 'Free Agent'}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                  <span>Inspect</span>
                                  <span className="text-amber-600 dark:text-amber-400 font-semibold group-hover:underline flex items-center gap-0.5">
                                    Stats &rarr;
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Section 2: Bench Players */}
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                              Bench Reserves ({Math.max(0, data.squad.members.length - 5)}/3)
                            </h3>
                          </div>
                          <span className="text-xs text-slate-400">
                            Available Substitutes
                          </span>
                        </div>

                        {data.squad.members.length <= 5 ? (
                          <div className="p-4 text-center bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500">
                            No bench reserve players on this squad.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                            {data.squad.members.slice(5).map((member, benchIndex) => {
                              const player = member.player;
                              const playerId = player?.id || member.player_id;
                              const roleDisplay = getRoleBadgeLabel(player?.primary_role);
                              return (
                                <div
                                  key={member.id}
                                  onClick={() => playerId && setSelectedPlayerId(playerId)}
                                  className="group relative p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-800/35 hover:border-slate-400 dark:hover:border-slate-500 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden text-left flex flex-col justify-between"
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-1 mb-2.5">
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                        Bench {benchIndex + 1}
                                      </span>
                                      <div className="flex items-center gap-1 font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-200/60 dark:bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/60">
                                        <Coins className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span>${member.cost.toFixed(1)}M</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2.5 mt-2">
                                      <div className="relative shrink-0">
                                        {player?.profile_image_url ? (
                                          <img
                                            src={player.profile_image_url}
                                            alt={player.in_game_name || player.name}
                                            className="w-11 h-11 rounded-xl object-cover bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 group-hover:border-slate-400 transition-colors shadow-sm"
                                          />
                                        ) : (
                                          <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-black text-base text-slate-500 dark:text-slate-300 border border-slate-300 dark:border-slate-600 group-hover:border-slate-400 transition-colors">
                                            {(player?.in_game_name || player?.name || '?').charAt(0)}
                                          </div>
                                        )}
                                        {player?.availability_status === 'available' && (
                                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between">
                                          <p className="text-sm font-bold truncate text-slate-800 dark:text-slate-200 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
                                            {player?.in_game_name || player?.name || 'Unknown'}
                                          </p>
                                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100 shrink-0" />
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1">
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                            {roleDisplay}
                                          </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1" title={player?.professional_teams?.name || 'Free Agent'}>
                                          {player?.professional_teams?.name || 'Free Agent'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                    <span>Inspect</span>
                                    <span className="text-slate-500 dark:text-slate-400 font-medium group-hover:text-amber-400 flex items-center gap-0.5">
                                      Stats &rarr;
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: GAMEWEEK LINEUPS */}
              {activeTab === 'lineups' && (
                <div className="space-y-6">
                  {data.lineups.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                      No gameweek lineups recorded for this season.
                    </div>
                  ) : (
                    <>
                      {/* Gameweek Selector */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {data.lineups.map((lw) => (
                          <button
                            key={lw.gameweek_id}
                            onClick={() => setSelectedGwId(lw.gameweek_id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
                              (selectedGwId || data.lineups[0].gameweek_id) === lw.gameweek_id
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            GW {lw.gameweek_number || lw.gameweek_id} ({lw.total_points} pts)
                          </button>
                        ))}
                      </div>

                      {currentGwLineup && (
                        <div>
                          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
                            <div>
                              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                                Gameweek {currentGwLineup.gameweek_number || currentGwLineup.gameweek_id} Lineup
                              </h4>
                              <span className="text-xs text-slate-400">
                                Status: {currentGwLineup.locked ? 'Locked' : 'Open'}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-slate-500 uppercase tracking-wider">Score</span>
                              <p className="text-2xl font-bold font-mono text-amber-500">
                                {currentGwLineup.total_points} pts
                              </p>
                            </div>
                          </div>

                          {/* Starters Grid */}
                          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                            Starting 5
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                            {currentGwLineup.slots
                              .filter((s) => s.is_starter)
                              .map((slot) => (
                                <div
                                  key={slot.slot}
                                  onClick={() => slot.player_id && setSelectedPlayerId(slot.player_id)}
                                  className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500/60 dark:hover:border-amber-500/60 rounded-xl relative overflow-hidden cursor-pointer hover:shadow-md transition-all group"
                                  title="Click to view player stats"
                                >
                                  {slot.is_captain && (
                                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-amber-500 text-slate-900 text-[10px] font-black uppercase tracking-wider shadow">
                                      C (2x)
                                    </span>
                                  )}
                                  {slot.is_vice_captain && (
                                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-blue-500 text-white text-[10px] font-black uppercase tracking-wider shadow">
                                      VC
                                    </span>
                                  )}
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                    {ROLE_LABELS[slot.slot] || slot.slot}
                                  </span>
                                  <p className="font-bold text-sm text-slate-900 dark:text-white mt-1 truncate group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
                                    {slot.player?.in_game_name || slot.player?.name || `Player #${slot.player_id}`}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {slot.player?.professional_teams?.name || 'Pro Team'}
                                  </p>
                                </div>
                              ))}
                          </div>

                          {/* Bench Grid */}
                          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                            Bench
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {currentGwLineup.slots
                              .filter((s) => !s.is_starter)
                              .map((slot) => (
                                <div
                                  key={slot.slot}
                                  onClick={() => slot.player_id && setSelectedPlayerId(slot.player_id)}
                                  className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 hover:border-slate-400 dark:hover:border-slate-500 rounded-xl cursor-pointer hover:shadow-md transition-all group"
                                  title="Click to view player stats"
                                >
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                    {ROLE_LABELS[slot.slot] || slot.slot}
                                  </span>
                                  <p className="font-bold text-sm text-slate-700 dark:text-slate-300 mt-1 truncate group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
                                    {slot.player?.in_game_name || slot.player?.name || `Player #${slot.player_id}`}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate">
                                    {slot.player?.professional_teams?.name || 'Pro Team'}
                                  </p>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: TRANSFERS */}
              {activeTab === 'transfers' && (
                <div className="space-y-4">
                  {data.transfers.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                      No transfers made by this team yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                          <tr>
                            <th className="px-4 py-3 font-medium">Gameweek</th>
                            <th className="px-4 py-3 font-medium">Player Out</th>
                            <th className="px-4 py-3 font-medium">Player In</th>
                            <th className="px-4 py-3 font-medium text-right">Fee</th>
                            <th className="px-4 py-3 font-medium text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                          {data.transfers.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                GW {t.gameweek_number || t.gameweek_id}
                              </td>
                              <td className="px-4 py-3">
                                {t.player_out ? (
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    <span className="text-red-600 dark:text-red-400 font-medium">
                                      {t.player_out.in_game_name || t.player_out.name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {t.player_in ? (
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    <span className="text-green-600 dark:text-green-400 font-medium">
                                      {t.player_in.in_game_name || t.player_in.name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                                {t.transfer_fee > 0 ? `-${t.transfer_fee} pts` : 'Free'}
                              </td>
                              <td className="px-4 py-3 text-right text-xs text-slate-400">
                                {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: LEAGUES */}
              {activeTab === 'leagues' && (
                <div className="space-y-4">
                  {data.leagues.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                      This team is not registered in any leagues.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                          <tr>
                            <th className="px-4 py-3 font-medium">League Name</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium">Privacy</th>
                            <th className="px-4 py-3 font-medium text-right">Rank</th>
                            <th className="px-4 py-3 font-medium text-right">Points</th>
                            <th className="px-4 py-3 font-medium text-right">Joined</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                          {data.leagues.map((lp) => (
                            <tr key={lp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                {lp.league?.name || `League #${lp.id}`}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs capitalize px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {lp.league?.league_type || 'Classic'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500 capitalize">
                                {lp.league?.privacy_level || 'Public'}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                                {lp.rank ? `#${lp.rank}` : '—'}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-amber-500">
                                {lp.points.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right text-xs text-slate-400">
                                {lp.joined_at ? new Date(lp.joined_at).toLocaleDateString() : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Fantasy Team ID: {teamId}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Layered Player Detail Inspection Modal */}
      {selectedPlayerId && (
        <AdminPlayerDetailModal
          playerId={selectedPlayerId}
          onClose={() => setSelectedPlayerId(null)}
          onNavigate={() => {
            setSelectedPlayerId(null);
            onClose();
          }}
        />
      )}
    </div>
  );
}

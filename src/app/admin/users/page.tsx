'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Users,
  Search,
  Shield,
  Trophy,
  Crown,
  Eye,
  RefreshCw,
  Mail,
  UserCheck,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import AdminUserDetailModal from '@/components/admin/AdminUserDetailModal';

interface UserItem {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country_code: string | null;
  role: string;
  is_premium: boolean;
  subscription_tier: string | null;
  created_at: string;
  email: string | null;
  fantasy_team: {
    squad_name: string;
    total_points: number;
    global_rank: number | null;
  } | null;
  leagues_count: number;
  reports_count: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const limit = 25;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (appliedSearch) params.append('search', appliedSearch);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (tierFilter !== 'all') params.append('tier', tierFilter);

      const res = await fetchWithAuth(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load admin users', err);
    } finally {
      setLoading(false);
    }
  }, [page, appliedSearch, roleFilter, tierFilter, limit]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers, refreshVersion]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const totalPages = Math.ceil(total / limit);

  // Compute local KPI stats
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const squadsCount = users.filter((u) => u.fantasy_team !== null).length;
  const premiumCount = users.filter((u) => u.is_premium).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-900 dark:text-white">
            <Users className="h-8 w-8 text-amber-500 dark:text-amber-400" />
            User Management
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400 text-sm">
            Inspect, search, and manage registered manager accounts and roles.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshVersion((v) => v + 1)}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
            <Users className="w-4 h-4 text-cyan-500" />
            <p className="text-xs uppercase font-semibold tracking-wider">Total Users</p>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{total}</p>
        </div>

        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
            <Shield className="w-4 h-4 text-purple-500" />
            <p className="text-xs uppercase font-semibold tracking-wider">Administrators</p>
          </div>
          <p className="text-3xl font-extrabold text-purple-600 dark:text-purple-400">
            {adminCount}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
            <Trophy className="w-4 h-4 text-amber-500" />
            <p className="text-xs uppercase font-semibold tracking-wider">Active Squads</p>
          </div>
          <p className="text-3xl font-extrabold text-amber-500">
            {squadsCount}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
            <Crown className="w-4 h-4 text-emerald-500" />
            <p className="text-xs uppercase font-semibold tracking-wider">Premium Members</p>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {premiumCount}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/80 flex flex-wrap gap-4 items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[260px] max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username, display name, or UUID..."
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
            />
          </form>

          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Roles</option>
              <option value="user">Standard Users</option>
              <option value="admin">Administrators</option>
            </select>

            <select
              value={tierFilter}
              onChange={(e) => {
                setTierFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Tiers</option>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                <th className="px-4 py-3">Manager / Account</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Fantasy Squad</th>
                <th className="px-4 py-3">Leagues</th>
                <th className="px-4 py-3">Registered</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50 text-sm">
              {loading && users.length === 0 ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`user-skeleton-${index}`} className="animate-pulse">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <div className="space-y-1.5">
                          <div className="h-3.5 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
                          <div className="h-2.5 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4"><div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" /></td>
                    <td className="px-4 py-4"><div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-3.5 w-12 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-3.5 w-20 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="px-4 py-4 text-right"><div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    No users found matching your filters.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <Image
                            src={user.avatar_url}
                            alt="Avatar"
                            width={36}
                            height={36}
                            unoptimized
                            className="w-9 h-9 rounded-full object-cover border border-slate-300 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300">
                            {user.username.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {user.display_name || user.username}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            @{user.username}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">
                      {user.email || '—'}
                    </td>

                    <td className="px-4 py-3">
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                          <Shield className="w-3 h-3" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          User
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {user.fantasy_team ? (
                        <div className="text-xs">
                          <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[150px]">
                            {user.fantasy_team.squad_name}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">
                            <span className="text-amber-600 dark:text-amber-400 font-bold">{user.fantasy_team.total_points} pts</span>
                            {user.fantasy_team.global_rank && ` • Rank #${user.fantasy_team.global_rank}`}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No squad</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      {user.leagues_count > 0 ? (
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {user.leagues_count} league{user.leagues_count === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(user.id)}
                        title="Inspect user details"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-500" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 flex items-center justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} users
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-xs font-medium"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-xs font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUserId && (
        <AdminUserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onUserUpdated={() => setRefreshVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}

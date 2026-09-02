'use client';

import { useState } from 'react';
import { Search, Shield, Users, Trophy, Lock, Globe } from 'lucide-react';

interface AdminLeague {
  id: string;
  name: string;
  type: 'classic' | 'head_to_head';
  privacy: 'public' | 'private';
  ownerUsername: string;
  memberCount: number;
  maxMembers: number;
  status: 'active' | 'full' | 'completed';
  totalPoints: number;
  createdAt: string;
}

const mockLeagues: AdminLeague[] = [
  { id: '1', name: 'The DPC Champions', type: 'classic', privacy: 'public', ownerUsername: 'grantmad', memberCount: 18, maxMembers: 32, status: 'active', totalPoints: 28400, createdAt: '2026-08-01' },
  { id: '2', name: 'mates only', type: 'head_to_head', privacy: 'private', ownerUsername: 'dotafan99', memberCount: 6, maxMembers: 8, status: 'active', totalPoints: 9810, createdAt: '2026-08-03' },
  { id: '3', name: 'TI Watch Party League', type: 'classic', privacy: 'public', ownerUsername: 'esportsking', memberCount: 32, maxMembers: 32, status: 'full', totalPoints: 51200, createdAt: '2026-07-20' },
  { id: '4', name: 'Office Fantasy Cup', type: 'head_to_head', privacy: 'private', ownerUsername: 'midgang', memberCount: 4, maxMembers: 4, status: 'active', totalPoints: 6340, createdAt: '2026-08-10' },
  { id: '5', name: 'Global Dota Masters', type: 'classic', privacy: 'public', ownerUsername: 'ward_placer', memberCount: 24, maxMembers: 32, status: 'active', totalPoints: 38720, createdAt: '2026-07-28' },
];

const statusStyles: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  full: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  completed: 'bg-slate-700/50 text-slate-400 border-slate-600',
};

export default function AdminLeaguesPage() {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState('');

  const filtered = mockLeagues.filter((l) => {
    const matchesQuery = `${l.name} ${l.ownerUsername}`.toLowerCase().includes(query.toLowerCase());
    const matchesType = !typeFilter || l.type === typeFilter;
    const matchesPrivacy = !privacyFilter || l.privacy === privacyFilter;
    return matchesQuery && matchesType && matchesPrivacy;
  });

  const totalMembers = mockLeagues.reduce((s, l) => s + l.memberCount, 0);
  const publicCount = mockLeagues.filter(l => l.privacy === 'public').length;
  const privateCount = mockLeagues.filter(l => l.privacy === 'private').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-8">
      <div>
        <h1 className="text-3xl font-bold text-white">League Management</h1>
        <p className="mt-1 text-slate-400">Monitor and manage all active leagues across the platform.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Leagues</p>
          <p className="text-3xl font-bold text-white">{mockLeagues.length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Members</p>
          <p className="text-3xl font-bold text-amber-400">{totalMembers}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <p className="text-xs text-slate-400 uppercase tracking-wider">Public</p>
          </div>
          <p className="text-3xl font-bold text-blue-400">{publicCount}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-3.5 h-3.5 text-purple-400" />
            <p className="text-xs text-slate-400 uppercase tracking-wider">Private</p>
          </div>
          <p className="text-3xl font-bold text-purple-400">{privateCount}</p>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by league name or owner..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">All Types</option>
            <option value="classic">Classic</option>
            <option value="head_to_head">Head-to-Head</option>
          </select>
          <select
            value={privacyFilter}
            onChange={(e) => setPrivacyFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">All Privacy</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
          <span className="text-sm text-slate-400">{filtered.length} leagues</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-700 text-slate-400 text-sm">
                <th className="px-4 py-3 font-medium">League</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Privacy</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium text-right">Members</th>
                <th className="px-4 py-3 font-medium text-right">Total Pts</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    No leagues found.
                  </td>
                </tr>
              ) : (
                filtered.map((league) => (
                  <tr key={league.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                          <Shield className="w-4 h-4 text-amber-400" />
                        </div>
                        <span className="font-medium text-white text-sm">{league.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded border ${
                        league.type === 'classic'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      }`}>
                        {league.type === 'classic' ? 'Classic' : 'H2H'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        {league.privacy === 'public'
                          ? <><Globe className="w-3.5 h-3.5 text-blue-400" /><span className="text-blue-400">Public</span></>
                          : <><Lock className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-400">Private</span></>
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-sm">{league.ownerUsername}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      <span className="text-white font-medium">{league.memberCount}</span>
                      <span className="text-slate-500">/{league.maxMembers}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400 font-bold text-sm">
                      {league.totalPoints.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded border capitalize ${statusStyles[league.status]}`}>
                        {league.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">{league.createdAt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

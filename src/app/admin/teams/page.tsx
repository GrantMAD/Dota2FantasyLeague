'use client';

import { useMemo, useState, useEffect } from 'react';
import { Trophy, Pencil, X, Check, Globe, Clock, Database, Link, Image } from 'lucide-react';

interface TeamRecord {
  id: number;
  name: string;
  slug: string;
  tag: string;
  region: string;
  logo_url: string;
  data_provider_id: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  // Computed
  roster: number;
  status: 'active' | 'inactive' | 'pending';
  rating: number;
}

const statusStyles: Record<TeamRecord['status'], string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/30',
  inactive: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AdminTeamsPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | TeamRecord['status']>('all');
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<TeamRecord>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadTeams() {
      try {
        const res = await fetch('/api/teams?limit=200');
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json.data) ? json.data : [];
          setTeams(
            items.map((t: any) => ({
              id: t.id,
              name: t.name ?? '',
              slug: t.slug ?? '',
              tag: t.tag ?? '',
              region: t.region ?? 'Global',
              logo_url: t.logo_url ?? '',
              data_provider_id: t.data_provider_id ?? '',
              last_synced_at: t.last_synced_at ?? null,
              created_at: t.created_at ?? '',
              updated_at: t.updated_at ?? '',
              roster: 5,
              status: 'active' as const,
              rating: 85,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load teams', err);
      } finally {
        setLoading(false);
      }
    }
    loadTeams();
  }, []);

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const matchesQuery = `${team.name} ${team.region} ${team.tag} ${team.slug}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesFilter = filter === 'all' || team.status === filter;
      return matchesQuery && matchesFilter;
    });
  }, [filter, query, teams]);

  const handleManage = (team: TeamRecord) => {
    if (editingId === team.id) {
      setEditingId(null);
      setDraft({});
      return;
    }
    setEditingId(team.id);
    setDraft({
      name: team.name,
      slug: team.slug,
      tag: team.tag,
      region: team.region,
      logo_url: team.logo_url,
    });
  };

  const handleSave = async (team: TeamRecord) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          slug: draft.slug,
          tag: draft.tag,
          region: draft.region,
          logo_url: draft.logo_url,
        }),
      });

      if (res.ok) {
        setTeams((prev) =>
          prev.map((t) =>
            t.id === team.id
              ? {
                  ...t,
                  name: draft.name ?? t.name,
                  slug: draft.slug ?? t.slug,
                  tag: draft.tag ?? t.tag,
                  region: draft.region ?? t.region,
                  logo_url: draft.logo_url ?? t.logo_url,
                  updated_at: new Date().toISOString(),
                }
              : t
          )
        );
        setEditingId(null);
        setDraft({});
      } else {
        const json = await res.json().catch(() => ({}));
        console.error('Failed to save team', json);
      }
    } catch (err) {
      console.error('Error saving team', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
          <Trophy className="h-8 w-8 text-amber-400" />
          Teams Management
        </h1>
        <p className="mt-1 text-gray-400">Track and manage professional team data</p>
      </div>

      {/* Search & Filter */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 rounded border border-gray-700 bg-gray-900/40 px-4 py-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, region, tag or slug…"
              className="w-full bg-transparent text-white placeholder-gray-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'active', 'pending', 'inactive'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`rounded px-3 py-2 text-sm font-medium ${
                  filter === option
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {option === 'all' ? 'All' : option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total Teams" value={teams.length} />
        <StatCard label="Active" value={teams.filter((t) => t.status === 'active').length} />
        <StatCard
          label="Avg Rating"
          value={(teams.reduce((s, t) => s + t.rating, 0) / (teams.length || 1)).toFixed(1)}
        />
      </div>

      {loading && <p className="text-center text-gray-400">Loading teams…</p>}

      {/* Team list */}
      <div className="space-y-3">
        {filteredTeams.map((team) => (
          <div
            key={team.id}
            className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800/50"
          >
            {/* ── Summary row ── */}
            <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                {/* Logo */}
                {team.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={team.logo_url}
                    alt={`${team.name} logo`}
                    className="h-12 w-12 flex-shrink-0 rounded-md object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-gray-700 text-lg font-bold text-gray-400">
                    {team.tag ? team.tag.slice(0, 2).toUpperCase() : team.name.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold text-white">{team.name}</h3>
                    {team.tag && (
                      <span className="rounded border border-gray-600 px-2 py-0.5 font-mono text-xs text-gray-400">
                        {team.tag}
                      </span>
                    )}
                    <span className={`rounded border px-2 py-1 text-xs font-medium ${statusStyles[team.status]}`}>
                      {team.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-400">
                    <Globe className="mr-1 inline h-3.5 w-3.5" />
                    {team.region}
                    {team.slug && (
                      <>
                        <span className="mx-2 text-gray-600">•</span>
                        <span className="font-mono text-xs text-gray-500">/{team.slug}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Rating</p>
                  <p className="text-lg font-bold text-white">{team.rating}</p>
                </div>
                <button
                  onClick={() => handleManage(team)}
                  className={`flex items-center gap-2 rounded px-4 py-2 font-medium transition-colors ${
                    editingId === team.id
                      ? 'bg-gray-600/40 text-gray-300 hover:bg-gray-600/60'
                      : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                  }`}
                >
                  <Pencil className="h-4 w-4" />
                  {editingId === team.id ? 'Close' : 'Manage'}
                </button>
              </div>
            </div>

            {/* ── Read-only metadata strip ── */}
            <div
              className="grid grid-cols-2 gap-x-6 gap-y-2 border-t px-5 py-3 text-xs md:grid-cols-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
            >
              <MetaItem icon={<Database className="h-3.5 w-3.5" />} label="Provider ID" value={team.data_provider_id || '—'} />
              <MetaItem icon={<Link className="h-3.5 w-3.5" />} label="Slug" value={team.slug || '—'} mono />
              <MetaItem icon={<Clock className="h-3.5 w-3.5" />} label="Last synced" value={formatDate(team.last_synced_at)} />
              <MetaItem icon={<Clock className="h-3.5 w-3.5" />} label="Created" value={formatDate(team.created_at)} />
              <MetaItem icon={<Clock className="h-3.5 w-3.5" />} label="Updated" value={formatDate(team.updated_at)} />
              <MetaItem icon={<Image className="h-3.5 w-3.5" />} label="Logo URL" value={team.logo_url || '—'} truncate />
            </div>

            {/* ── Inline edit panel ── */}
            {editingId === team.id && (
              <div
                className="border-t p-5"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)' }}
              >
                <h4
                  className="mb-4 text-sm font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Edit Team
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="Team Name">
                    <input
                      value={draft.name ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      className="w-full rounded px-3 py-2 outline-none focus:ring-1 focus:ring-amber-500"
                      style={{
                        border: '1px solid var(--border)',
                        background: 'var(--surface-raised)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </Field>
                  <Field label="Region">
                    <input
                      value={draft.region ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, region: e.target.value }))}
                      className="w-full rounded px-3 py-2 outline-none focus:ring-1 focus:ring-amber-500"
                      style={{
                        border: '1px solid var(--border)',
                        background: 'var(--surface-raised)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </Field>
                  <Field label="Tag / Abbreviation">
                    <input
                      value={draft.tag ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, tag: e.target.value }))}
                      placeholder="e.g. TI, EG, LGD"
                      className="w-full rounded px-3 py-2 outline-none focus:ring-1 focus:ring-amber-500"
                      style={{
                        border: '1px solid var(--border)',
                        background: 'var(--surface-raised)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </Field>
                  <Field label="Slug">
                    <input
                      value={draft.slug ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
                      placeholder="e.g. team-spirit"
                      className="w-full rounded px-3 py-2 font-mono outline-none focus:ring-1 focus:ring-amber-500"
                      style={{
                        border: '1px solid var(--border)',
                        background: 'var(--surface-raised)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </Field>
                  <Field label="Logo URL" className="md:col-span-2">
                    <input
                      value={draft.logo_url ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, logo_url: e.target.value }))}
                      placeholder="https://…"
                      className="w-full rounded px-3 py-2 outline-none focus:ring-1 focus:ring-amber-500"
                      style={{
                        border: '1px solid var(--border)',
                        background: 'var(--surface-raised)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </Field>
                </div>

                {/* Logo preview */}
                {draft.logo_url && (
                  <div className="mt-4 flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Preview:</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={draft.logo_url}
                      alt="Logo preview"
                      className="h-10 w-10 rounded object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    onClick={() => { setEditingId(null); setDraft({}); }}
                    className="flex items-center gap-2 rounded px-4 py-2 transition-colors hover:opacity-80"
                    style={{
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      background: 'var(--surface-raised)',
                    }}
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSave(team)}
                    disabled={saving}
                    className="flex items-center gap-2 rounded bg-amber-500 px-4 py-2 font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {!loading && filteredTeams.length === 0 && (
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-12 text-center text-gray-400">
            No teams match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function MetaItem({
  icon,
  label,
  value,
  mono = false,
  truncate = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="flex items-center gap-1"
        style={{ color: 'var(--text-muted)' }}
      >
        {icon}
        {label}
      </span>
      <span
        className={`${mono ? 'font-mono' : ''} ${truncate ? 'max-w-[200px] truncate' : ''}`}
        style={{ color: 'var(--text-secondary)' }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

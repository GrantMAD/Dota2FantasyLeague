'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';

type PlayerStatus = 'active' | 'inactive' | 'flagged';

interface PlayerRecord {
  id: number;
  name: string;
  team: string;
  role: string;
  price: number;
  status: PlayerStatus;
  fantasyPoints: number;
}

const initialPlayers: PlayerRecord[] = [
  { id: 1, name: 'Ammar', team: 'Tundra', role: 'Carry', price: 9970000, status: 'active', fantasyPoints: 142 },
  { id: 2, name: 'Tobi', team: 'Gaimin Gladiators', role: 'Support', price: 8500000, status: 'active', fantasyPoints: 118 },
  { id: 3, name: 'Mikey', team: 'Liquid', role: 'Mid', price: 9200000, status: 'flagged', fantasyPoints: 96 },
  { id: 4, name: 'Stinger', team: 'Shopify Rebellion', role: 'Offlane', price: 7600000, status: 'inactive', fantasyPoints: 74 },
  { id: 5, name: 'Mongol', team: 'Tundra', role: 'Support', price: 8800000, status: 'active', fantasyPoints: 131 },
];

const statusStyles: Record<PlayerStatus, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/30',
  inactive: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
  flagged: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
};

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<PlayerRecord[]>(initialPlayers);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PlayerStatus>('all');
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<PlayerRecord>({
    id: 0,
    name: '',
    team: '',
    role: 'Carry',
    price: 0,
    status: 'active',
    fantasyPoints: 0,
  });

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      const matchesQuery = `${player.name} ${player.team} ${player.role}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesStatus = statusFilter === 'all' || player.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [players, query, statusFilter]);

  const totalValue = players.reduce((sum, player) => sum + player.price, 0);

  const handleSave = () => {
    if (!draft.name.trim() || !draft.team.trim()) return;

    setPlayers((current) => {
      if (draft.id) {
        return current.map((player) => (player.id === draft.id ? draft : player));
      }
      return [{ ...draft, id: Date.now() }, ...current];
    });

    setDraft({
      id: 0,
      name: '',
      team: '',
      role: 'Carry',
      price: 0,
      status: 'active',
      fantasyPoints: 0,
    });
    setShowForm(false);
  };

  const handleEdit = (player: PlayerRecord) => {
    setDraft(player);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    setPlayers((current) => current.filter((player) => player.id !== id));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Players Management</h1>
          <p className="mt-1 text-gray-400">Review, edit, and curate professional player data</p>
        </div>
        <button
          onClick={() => {
            setDraft({
              id: 0,
              name: '',
              team: '',
              role: 'Carry',
              price: 0,
              status: 'active',
              fantasyPoints: 0,
            });
            setShowForm(true);
          }}
          className="flex items-center gap-2 rounded bg-amber-500/20 px-4 py-2 font-medium text-amber-400 hover:bg-amber-500/30"
        >
          <Plus className="h-5 w-5" />
          Add Player
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total Players" value={players.length} />
        <StatCard label="Active" value={players.filter((p) => p.status === 'active').length} />
        <StatCard label="Market Value" value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalValue)} />
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 rounded border border-gray-700 bg-gray-900/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                type="text"
                placeholder="Search players, teams, or roles..."
                className="w-full bg-transparent text-white placeholder-gray-500 outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2">
            {(['all', 'active', 'inactive', 'flagged'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatusFilter(option)}
                className={`rounded px-3 py-2 text-sm font-medium ${
                  statusFilter === option
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

      {showForm && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-6">
          <h2 className="mb-4 text-xl font-semibold text-white">{draft.id ? 'Edit Player' : 'Add Player'}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Name">
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white outline-none focus:border-amber-500" />
            </Field>
            <Field label="Team">
              <input value={draft.team} onChange={(event) => setDraft({ ...draft, team: event.target.value })} className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white outline-none focus:border-amber-500" />
            </Field>
            <Field label="Role">
              <select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white outline-none focus:border-amber-500">
                <option>Carry</option>
                <option>Mid</option>
                <option>Offlane</option>
                <option>Support</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as PlayerStatus })} className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white outline-none focus:border-amber-500">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="flagged">Flagged</option>
              </select>
            </Field>
            <Field label="Price">
              <input type="number" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white outline-none focus:border-amber-500" />
            </Field>
            <Field label="Fantasy Points">
              <input type="number" value={draft.fantasyPoints} onChange={(event) => setDraft({ ...draft, fantasyPoints: Number(event.target.value) })} className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-white outline-none focus:border-amber-500" />
            </Field>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={() => setShowForm(false)} className="rounded border border-gray-600 px-4 py-2 text-gray-300 hover:bg-gray-700">Cancel</button>
            <button onClick={handleSave} className="rounded bg-amber-500 px-4 py-2 font-medium text-gray-950 hover:bg-amber-400">Save</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filteredPlayers.length === 0 ? (
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-12 text-center text-gray-400">
            No players match the current filters.
          </div>
        ) : (
          filteredPlayers.map((player) => (
            <div key={player.id} className="rounded-lg border border-gray-700 bg-gray-800/50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-white">{player.name}</h3>
                    <span className={`rounded border px-2 py-1 text-xs font-medium ${statusStyles[player.status]}`}>
                      {player.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                    <span>{player.team}</span>
                    <span>•</span>
                    <span>{player.role}</span>
                    <span>•</span>
                    <span>{player.fantasyPoints} FP</span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Price</p>
                    <p className="text-lg font-semibold text-white">${(player.price / 1000000).toFixed(2)}M</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(player)} className="rounded border border-gray-600 p-2 text-gray-300 hover:bg-gray-700">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(player.id)} className="rounded border border-red-500/40 p-2 text-red-400 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-gray-400">{label}</span>
      {children}
    </label>
  );
}

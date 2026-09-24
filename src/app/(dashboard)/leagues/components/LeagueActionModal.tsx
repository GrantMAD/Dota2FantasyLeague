'use client';

import { useState } from 'react';
import { X, Loader2, Plus, Hash } from 'lucide-react';

type FormState = {
  name: string;
  type: 'classic' | 'h2h';
  privacyLevel: 'public' | 'private';
  maxParticipants: number;
  description: string;
};

interface LeagueActionModalProps {
  mode: 'create' | 'join';
  onClose: () => void;
  onCreate?: (form: FormState) => Promise<void>;
  onJoin?: (code: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  successMessage?: string | null;
}

export function LeagueActionModal({
  mode,
  onClose,
  onCreate,
  onJoin,
  isLoading,
  error,
  successMessage,
}: LeagueActionModalProps) {
  const [form, setForm] = useState<FormState>({
    name: '',
    type: 'classic',
    privacyLevel: 'private',
    maxParticipants: 10,
    description: '',
  });
  const [joinCode, setJoinCode] = useState('');

  const handleSubmit = async () => {
    if (mode === 'create' && onCreate) {
      await onCreate(form);
    } else if (mode === 'join' && onJoin) {
      await onJoin(joinCode);
    }
  };

  const canSubmit = mode === 'create' ? form.name.trim().length > 0 : joinCode.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300">
              {mode === 'create' ? <Plus className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
              {mode === 'create' ? 'New League' : 'Join League'}
            </div>
            <h2 className="text-xl font-bold text-white">
              {mode === 'create' ? 'Create a League' : 'Join by Invite Code'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-6">
          {mode === 'create' ? (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">League Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. The Premier Fantasy Circuit"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What is this league about?"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Format</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as 'classic' | 'h2h' })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white focus:border-amber-500/60 focus:outline-none transition"
                  >
                    <option value="classic">Classic</option>
                    <option value="h2h">Head-to-Head</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Privacy</label>
                  <select
                    value={form.privacyLevel}
                    onChange={(e) => setForm({ ...form, privacyLevel: e.target.value as 'public' | 'private' })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-white focus:border-amber-500/60 focus:outline-none transition"
                  >
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Max Participants (4-32)
                </label>
                <input
                  type="number"
                  min={4}
                  max={32}
                  value={form.maxParticipants}
                  onChange={(e) => setForm({ ...form, maxParticipants: Number(e.target.value) || 10 })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Invite Code</label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter your invite code"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 font-mono text-sm uppercase text-white placeholder-slate-500 focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition"
              />
              <p className="mt-2 text-xs text-slate-500">Invite codes are case-insensitive. Ask the league creator for their code.</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
              {successMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-slate-800 p-6 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !canSubmit}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {mode === 'create' ? 'Creating...' : 'Joining...'}
              </>
            ) : mode === 'create' ? (
              'Create League'
            ) : (
              'Join League'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

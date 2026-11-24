'use client';

import { useMemo, useRef, useState } from 'react';
import { X, Loader2, Plus, Hash, Users, Shield, Swords, Trophy } from 'lucide-react';
import { useAccessibleDialog } from '@/components/use-accessible-dialog';

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

const LEAGUE_NAME_MAX = 40;

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
  const [touched, setTouched] = useState<{ name?: boolean; maxParticipants?: boolean; joinCode?: boolean }>({});
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ open: true, onClose, initialFocusRef: closeButtonRef });

  const validateCreate = (next: FormState) => {
    const errors: { name?: string; maxParticipants?: string } = {};
    const trimmedName = next.name.trim();
    if (!trimmedName) {
      errors.name = 'League name is required.';
    } else if (trimmedName.length > LEAGUE_NAME_MAX) {
      errors.name = `League name must be ${LEAGUE_NAME_MAX} characters or fewer.`;
    }
    if (!Number.isFinite(next.maxParticipants) || next.maxParticipants < 4 || next.maxParticipants > 32) {
      errors.maxParticipants = 'Max participants must be between 4 and 32.';
    }
    return errors;
  };

  const validateJoin = (code: string) => {
    const errors: { joinCode?: string } = {};
    const trimmed = code.trim();
    if (!trimmed) {
      errors.joinCode = 'Invite code is required.';
    } else if (trimmed.length < 4) {
      errors.joinCode = 'Invite code looks too short.';
    }
    return errors;
  };

  const createErrors = useMemo(() => validateCreate(form), [form]);
  const joinErrors = useMemo(() => validateJoin(joinCode), [joinCode]);

  const handleSubmit = async () => {
    if (mode === 'create') {
      const errors = validateCreate(form);
      setTouched({ name: true, maxParticipants: true });
      if (Object.keys(errors).length > 0 || !onCreate) return;
      await onCreate({
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        maxParticipants: Math.max(4, Math.min(32, Math.round(form.maxParticipants || 10))),
      });
      return;
    }

    const errors = validateJoin(joinCode);
    setTouched({ joinCode: true });
    if (Object.keys(errors).length > 0 || !onJoin) return;
    await onJoin(joinCode.trim().toUpperCase());
  };

  const canSubmit = mode === 'create'
    ? form.name.trim().length > 0 && form.name.trim().length <= LEAGUE_NAME_MAX && form.maxParticipants >= 4 && form.maxParticipants <= 32
    : joinCode.trim().length >= 4;

  const previewName = form.name.trim() || 'Your league name';
  const previewDescription = form.description.trim() || 'Add a short description so managers know what this league is about.';
  const isH2H = form.type === 'h2h';
  const accent = isH2H ? '#a78bfa' : '#f59e0b';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="league-action-modal-title"
        aria-describedby="league-action-modal-description"
        tabIndex={-1}
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/50"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] p-6">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300">
              {mode === 'create' ? <Plus className="h-3 w-3" aria-hidden="true" /> : <Hash className="h-3 w-3" aria-hidden="true" />}
              {mode === 'create' ? 'New League' : 'Join League'}
            </div>
            <h2 id="league-action-modal-title" className="text-xl font-bold text-[var(--text-primary)]">
              {mode === 'create' ? 'Create a League' : 'Join by Invite Code'}
            </h2>
            <p id="league-action-modal-description" className="sr-only">
              {mode === 'create' ? 'Create a new league with name, format, privacy, and participant settings.' : 'Enter an invite code to join an existing league.'}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[var(--text-muted)] transition hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label="Close league modal"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-6">
          {mode === 'create' ? (
            <>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label htmlFor="league-name" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">League Name</label>
                  <span className={`text-xs ${form.name.length > LEAGUE_NAME_MAX ? 'text-rose-400' : 'text-[var(--text-muted)]'}`} aria-live="polite">
                    {form.name.length}/{LEAGUE_NAME_MAX}
                  </span>
                </div>
                <input
                  id="league-name"
                  value={form.name}
                  maxLength={LEAGUE_NAME_MAX + 10}
                  onChange={(e) => {
                    const next = { ...form, name: e.target.value };
                    setForm(next);
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, name: true }));
                  }}
                  placeholder="e.g. The Premier Fantasy Circuit"
                  aria-invalid={Boolean(touched.name && createErrors.name)}
                  aria-describedby={touched.name && createErrors.name ? 'league-name-error' : 'league-name-help'}
                  className={`w-full rounded-xl border bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition focus:outline-none focus:ring-1 ${
                    touched.name && createErrors.name
                      ? 'border-rose-500/60 focus:border-rose-500/60 focus:ring-rose-500/30'
                      : 'border-[var(--border)] focus:border-amber-500/60 focus:ring-amber-500/30'
                  }`}
                />
                <p id="league-name-help" className="mt-1.5 text-xs text-[var(--text-muted)]">Choose a clear name that helps managers recognize your league.</p>
                {touched.name && createErrors.name && (
                  <p id="league-name-error" className="mt-1.5 text-xs text-rose-300">{createErrors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="league-description" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Description</label>
                <textarea
                  id="league-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What is this league about?"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="league-type" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Format</label>
                  <select
                    id="league-type"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as 'classic' | 'h2h' })}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-amber-500/60 focus:outline-none"
                  >
                    <option value="classic">Classic</option>
                    <option value="h2h">Head-to-Head</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="league-privacy" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Privacy</label>
                  <select
                    id="league-privacy"
                    value={form.privacyLevel}
                    onChange={(e) => setForm({ ...form, privacyLevel: e.target.value as 'public' | 'private' })}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-amber-500/60 focus:outline-none"
                  >
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="league-max-participants" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Max Participants (4-32)
                </label>
                <input
                  id="league-max-participants"
                  type="number"
                  min={4}
                  max={32}
                  value={form.maxParticipants}
                  onChange={(e) => {
                    const next = { ...form, maxParticipants: Number(e.target.value) || 0 };
                    setForm(next);
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, maxParticipants: true }));
                  }}
                  aria-invalid={Boolean(touched.maxParticipants && createErrors.maxParticipants)}
                  aria-describedby={touched.maxParticipants && createErrors.maxParticipants ? 'league-max-participants-error' : undefined}
                  className={`w-full rounded-xl border bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-primary)] transition focus:outline-none focus:ring-1 ${
                    touched.maxParticipants && createErrors.maxParticipants
                      ? 'border-rose-500/60 focus:border-rose-500/60 focus:ring-rose-500/30'
                      : 'border-[var(--border)] focus:border-amber-500/60 focus:ring-amber-500/30'
                  }`}
                />
                {touched.maxParticipants && createErrors.maxParticipants && (
                  <p id="league-max-participants-error" className="mt-1.5 text-xs text-rose-300">{createErrors.maxParticipants}</p>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Preview</p>
                <div
                  className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg"
                  style={{
                    borderColor: `color-mix(in srgb, ${accent} 35%, var(--border))`,
                    boxShadow: `0 12px 32px color-mix(in srgb, ${accent} 8%, transparent)`,
                  }}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-1 opacity-80"
                    style={{ background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 15%, transparent))` }}
                  />
                  <div className="mb-3 flex items-start justify-between gap-3 pt-1">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${isH2H ? 'border-sky-500/30 bg-sky-500/10 text-sky-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400'}`}>
                        {isH2H ? <Swords className="h-5 w-5" aria-hidden="true" /> : <Trophy className="h-5 w-5" aria-hidden="true" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-bold leading-tight text-[var(--text-primary)]">{previewName}</h3>
                        <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-muted)]">{previewDescription}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${isH2H ? 'border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300'}`}>
                        {isH2H ? 'H2H' : 'Classic'}
                      </span>
                      <span className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-medium capitalize text-[var(--text-secondary)]">
                        <Shield className="h-3 w-3" aria-hidden="true" />
                        {form.privacyLevel}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        1 / {Math.max(4, Math.min(32, Number(form.maxParticipants) || 10))} managers
                      </span>
                      <span className="text-[var(--text-muted)]">Preview</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(4, Math.min(100, (1 / Math.max(4, Math.min(32, Number(form.maxParticipants) || 10))) * 100))}%`,
                          backgroundColor: accent,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="join-code" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Invite Code</label>
              <input
                id="join-code"
                value={joinCode}
                onChange={(e) => {
                  const next = e.target.value.toUpperCase();
                  setJoinCode(next);
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, joinCode: true }));
                }}
                placeholder="Enter your invite code"
                aria-invalid={Boolean(touched.joinCode && joinErrors.joinCode)}
                aria-describedby={touched.joinCode && joinErrors.joinCode ? 'join-code-error' : 'join-code-help'}
                className={`w-full rounded-xl border bg-[var(--surface-raised)] px-4 py-3 font-mono text-sm uppercase text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 ${
                  touched.joinCode && joinErrors.joinCode
                    ? 'border-rose-500/60 focus:border-rose-500/60 focus:ring-rose-500/30'
                    : 'border-[var(--border)] focus:border-amber-500/60 focus:ring-amber-500/30'
                }`}
              />
              <p id="join-code-help" className="mt-2 text-xs text-[var(--text-muted)]">Invite codes are case-insensitive. Ask the league creator for their code.</p>
              {touched.joinCode && joinErrors.joinCode && (
                <p id="join-code-error" className="mt-1.5 text-xs text-rose-300">{joinErrors.joinCode}</p>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300" role="alert">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300" role="status">
              {successMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-[var(--border)] p-6 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !canSubmit}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
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

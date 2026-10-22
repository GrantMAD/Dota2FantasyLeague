'use client';

import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

interface WaitlistResponse {
  waitlisted?: boolean;
  email?: string;
  error?: string;
}

const WaitlistOpenContext = createContext<((trigger: HTMLButtonElement) => void) | null>(null);

export function PremiumWaitlistProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const busyRef = useRef(busy);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!isOpen) {
      triggerRef.current?.focus();
      return;
    }
    const dialog = dialogRef.current;
    const getFocusableElements = () =>
      dialog?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      );
    getFocusableElements()?.[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        setIsOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusableElements = getFocusableElements();
      if (!focusableElements?.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (!dialog?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  async function openDialog(trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setIsOpen(true);
    setLoadingStatus(true);
    setError(null);
    setFeedback(null);
    setEditing(false);
    setConfirmRemoval(false);
    try {
      const response = await fetchWithAuth('/api/premium/waitlist');
      const result = (await response.json()) as WaitlistResponse;
      if (!response.ok) throw new Error(result.error || 'Unable to load waitlist status.');
      setEmail(result.email ?? '');
      setWaitlisted(result.waitlisted === true);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load waitlist status.');
    } finally {
      setLoadingStatus(false);
    }
  }

  async function submitWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent || busy) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetchWithAuth('/api/premium/waitlist', {
        method: 'POST',
        body: JSON.stringify({ email, consent }),
      });
      const result = (await response.json()) as WaitlistResponse;
      if (!response.ok) throw new Error(result.error || 'Unable to join the waitlist.');
      setEmail(email.trim().toLowerCase());
      setWaitlisted(true);
      setEditing(false);
      setConsent(false);
      setFeedback('You are on the Premium waitlist. No email has been sent.');
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to join the waitlist.');
    } finally {
      setBusy(false);
    }
  }

  async function removeWaitlistEntry() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetchWithAuth('/api/premium/waitlist', { method: 'DELETE' });
      const result = (await response.json()) as WaitlistResponse;
      if (!response.ok) throw new Error(result.error || 'Unable to remove your waitlist entry.');
      setWaitlisted(false);
      setEditing(false);
      setConfirmRemoval(false);
      setConsent(false);
      setFeedback('Your waitlist entry has been removed.');
    } catch (removeError: unknown) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to remove your waitlist entry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <WaitlistOpenContext.Provider value={(trigger) => void openDialog(trigger)}>
      {children}
      {isOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
          onClick={() => {
            if (!busy) setIsOpen(false);
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="premium-waitlist-title"
            tabIndex={-1}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-amber-500/30 bg-[var(--surface)] p-6 text-[var(--text-primary)] shadow-2xl shadow-amber-950/20 sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">Premium updates</p>
                <h2 id="premium-waitlist-title" className="mt-2 text-2xl font-black text-[var(--text-primary)]">
                  Join the waitlist
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close waitlist dialog"
                disabled={busy}
                onClick={() => setIsOpen(false)}
                className="rounded-xl p-2 text-[var(--text-muted)] transition hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingStatus ? (
              <p role="status" className="relative mt-5 text-sm text-[var(--text-secondary)]">Checking your waitlist status…</p>
            ) : waitlisted && !editing ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  <p className="text-sm leading-6 text-[var(--text-primary)]">
                    <span className="font-semibold">{email}</span> is on the Premium waitlist.
                    We are not sending emails yet.
                  </p>
                </div>
                {feedback ? <div role="status" className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2.5 text-sm text-cyan-800 dark:text-cyan-200">{feedback}</div> : null}
                {confirmRemoval ? (
                  <div className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
                    <p className="text-sm text-[var(--text-primary)]">Remove your email and withdraw your waitlist consent?</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeWaitlistEntry()}
                        className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                      >
                        {busy ? 'Removing…' : 'Confirm removal'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmRemoval(false)}
                        className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                      >
                        Keep me on the list
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(true);
                        setFeedback(null);
                      }}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                    >
                      Change email
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemoval(true)}
                      className="rounded-xl border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-500/10 dark:text-rose-200"
                    >
                      Remove me
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={(event) => void submitWaitlist(event)}>
                <p className="text-sm leading-6 text-[var(--text-secondary)]">
                  We will use this address only for Premium launch updates. Joining does not start a subscription,
                  and no email is sent now.
                </p>
                <div>
                  <label htmlFor="premium-waitlist-email" className="mb-1.5 block text-sm font-semibold text-[var(--text-primary)]">
                    Email address
                  </label>
                  <input
                    id="premium-waitlist-email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5 text-[var(--text-primary)] outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-amber-500"
                  />
                  <span className="text-sm leading-5 text-[var(--text-secondary)]">
                    I agree to receive Premium launch updates at this address. I can remove my waitlist entry at any time.{' '}
                    <Link href="/privacy" className="text-cyan-700 underline underline-offset-2 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200">
                      Privacy policy
                    </Link>
                  </span>
                </label>
                {error ? (
                  <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-800 dark:text-rose-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
                  </div>
                ) : null}
                {feedback ? <div role="status" className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2.5 text-sm text-cyan-800 dark:text-cyan-200">{feedback}</div> : null}
                <div className="flex flex-wrap justify-end gap-2">
                  {waitlisted ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setEditing(false);
                        setConsent(false);
                        setError(null);
                      }}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                    >
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    disabled={busy || !consent}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-amber-500/15 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? 'Saving…' : waitlisted ? 'Update email' : 'Join waitlist'}
                    {!busy ? <ArrowRight className="h-4 w-4" /> : null}
                  </button>
                </div>
              </form>
            )}
            {!loadingStatus && error && waitlisted && !editing ? (
              <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-800 dark:text-rose-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </WaitlistOpenContext.Provider>
  );
}

export function PremiumWaitlistButton({
  id,
  className,
}: {
  id: string;
  className: string;
}) {
  const openDialog = useContext(WaitlistOpenContext);
  if (!openDialog) throw new Error('PremiumWaitlistButton must be rendered within PremiumWaitlistProvider.');
  return (
    <button id={id} type="button" onClick={(event) => openDialog(event.currentTarget)} className={className}>
      Join the waitlist <ArrowRight className="h-4 w-4" />
    </button>
  );
}
